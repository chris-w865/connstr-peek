import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseConnectionString } from './parse.js'

test('parses a single-host url with query params and sslmode', () => {
  const info = parseConnectionString(
    'postgres://appuser:hunter2@db1.internal:5432/orders?sslmode=require&application_name=api',
  )
  assert.equal(info.format, 'url')
  assert.equal(info.scheme, 'postgres')
  assert.deepEqual(info.hosts, [{ host: 'db1.internal', port: '5432' }])
  assert.equal(info.database, 'orders')
  assert.equal(info.user, 'appuser')
  assert.equal(info.hasPassword, true)
  assert.equal(info.sslMode, 'require')
  assert.deepEqual(info.params, { application_name: 'api' })
})

test('parses a comma-separated multi-host replica set url', () => {
  const info = parseConnectionString(
    'mongodb://db1.internal:27017,db2.internal:27017,db3.internal/replset',
  )
  assert.deepEqual(info.hosts, [
    { host: 'db1.internal', port: '27017' },
    { host: 'db2.internal', port: '27017' },
    { host: 'db3.internal', port: null },
  ])
  assert.equal(info.database, 'replset')
})

test('parses an ipv6 host literal with and without a port', () => {
  const withPort = parseConnectionString('redis://[::1]:6379/0')
  assert.deepEqual(withPort.hosts, [{ host: '::1', port: '6379' }])

  const withoutPort = parseConnectionString('redis://[::1]/0')
  assert.deepEqual(withoutPort.hosts, [{ host: '::1', port: null }])
})

test('strips jdbc: prefix and reattaches it to the reported scheme', () => {
  const info = parseConnectionString('jdbc:postgresql://db.internal:5432/orders')
  assert.equal(info.scheme, 'jdbc:postgresql')
  assert.deepEqual(info.hosts, [{ host: 'db.internal', port: '5432' }])
})

test('treats scheme+suffix forms like mongodb+srv as the full scheme', () => {
  const info = parseConnectionString('mongodb+srv://appuser:hunter2@cluster0.internal/orders')
  assert.equal(info.scheme, 'mongodb+srv')
  assert.deepEqual(info.hosts, [{ host: 'cluster0.internal', port: null }])
})

test('mongodb+srv with no ssl param warns that TLS defaults to on', () => {
  const info = parseConnectionString('mongodb+srv://appuser:hunter2@cluster0.internal/orders')
  assert.deepEqual(info.warnings, [
    'mongodb+srv defaults to TLS enabled unless overridden with ssl=false',
  ])
})

test('mongodb+srv with an explicit ssl param does not warn about the TLS default', () => {
  const info = parseConnectionString(
    'mongodb+srv://appuser:hunter2@cluster0.internal/orders?ssl=false',
  )
  assert.deepEqual(info.warnings, [])
})

test('mongodb+srv flags an explicit port as invalid', () => {
  const info = parseConnectionString(
    'mongodb+srv://appuser:hunter2@cluster0.internal:27017/orders?ssl=true',
  )
  assert.deepEqual(info.warnings, [
    'mongodb+srv hostnames do not take a port — the port comes from the SRV record',
  ])
})

test('mongodb+srv flags a comma-separated host list as invalid', () => {
  const info = parseConnectionString(
    'mongodb+srv://appuser:hunter2@host1.internal,host2.internal/orders?ssl=true',
  )
  assert.deepEqual(info.warnings, [
    'mongodb+srv takes exactly one hostname; the real host list comes from a DNS SRV lookup at connect time, not from this string',
  ])
})

test('non-srv mongodb urls never get srv warnings', () => {
  const info = parseConnectionString('mongodb://db1.internal:27017,db2.internal:27017/orders')
  assert.deepEqual(info.warnings, [])
})

test('an empty password after the colon does not count as a password', () => {
  const info = parseConnectionString('postgres://appuser:@db.internal/orders')
  assert.equal(info.user, 'appuser')
  assert.equal(info.hasPassword, false)
})

test('only the first colon in credentials splits user from password', () => {
  const info = parseConnectionString('postgres://appuser:pa:ss@db.internal/orders')
  assert.equal(info.user, 'appuser')
  assert.equal(info.hasPassword, true)
})

test('a url with no credentials at all', () => {
  const info = parseConnectionString('postgres://db.internal/orders')
  assert.equal(info.user, null)
  assert.equal(info.hasPassword, false)
})

test('a url with a host but no path has no database', () => {
  const info = parseConnectionString('postgres://db.internal:5432')
  assert.equal(info.database, null)
})

test('a url with a query but no database segment has no database', () => {
  const info = parseConnectionString('postgres://db.internal/?sslmode=disable')
  assert.equal(info.database, null)
  assert.equal(info.sslMode, 'disable')
})

test('percent-encoded segments are decoded', () => {
  const info = parseConnectionString('postgres://app%20user:hunter2@db.internal/my%20db')
  assert.equal(info.user, 'app user')
  assert.equal(info.database, 'my db')
})

test('an unparseable percent-encoding is left as-is instead of throwing', () => {
  const info = parseConnectionString('postgres://db.internal/orders?name=100%')
  assert.equal(info.params.name, '100%')
})

test('parses an ODBC/ADO.NET key=value string', () => {
  const info = parseConnectionString(
    'Server=sql01.internal;Port=1433;Database=orders;User Id=appuser;Password=hunter2;Encrypt=true;',
  )
  assert.equal(info.format, 'keyvalue')
  assert.deepEqual(info.hosts, [{ host: 'sql01.internal', port: '1433' }])
  assert.equal(info.database, 'orders')
  assert.equal(info.user, 'appuser')
  assert.equal(info.hasPassword, true)
  assert.equal(info.sslMode, 'true')
})

test('parses the alternate ODBC key spellings', () => {
  const info = parseConnectionString(
    'Data Source=sql01.internal;Initial Catalog=orders;Uid=appuser;Pwd=hunter2;',
  )
  assert.deepEqual(info.hosts, [{ host: 'sql01.internal', port: null }])
  assert.equal(info.database, 'orders')
  assert.equal(info.user, 'appuser')
  assert.equal(info.hasPassword, true)
})

test('unrecognized key=value pairs are kept as extra params', () => {
  const info = parseConnectionString('Server=sql01.internal;Application Name=billing;')
  assert.deepEqual(info.params, { 'application name': 'billing' })
})

test('a string that is neither url nor key=value style is unknown', () => {
  const info = parseConnectionString('just some notes about a database')
  assert.equal(info.format, 'unknown')
  assert.deepEqual(info.hosts, [])
})
