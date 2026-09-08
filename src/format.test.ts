import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseConnectionString } from './parse.js'
import { formatJson, formatReport } from './format.js'

test('json report redacts the password in the raw string but never carries it as a field', () => {
  const info = parseConnectionString('postgres://appuser:hunter2@db.internal:5432/orders')
  const report = formatJson(info)
  assert.equal(report.hasPassword, true)
  assert.equal(report.redacted, 'postgres://appuser:***@db.internal:5432/orders')
  assert.equal(JSON.stringify(report).includes('hunter2'), false)
})

test('json report has no redacted string for key=value input', () => {
  const info = parseConnectionString('Server=sql01.internal;Database=orders;Pwd=hunter2;')
  const report = formatJson(info)
  assert.equal(report.format, 'keyvalue')
  assert.equal(report.redacted, '(redaction only supported for url-style strings)')
})

test('json report has a null redacted field for unrecognized input', () => {
  const info = parseConnectionString('just some notes about a database')
  const report = formatJson(info)
  assert.equal(report.format, 'unknown')
  assert.equal(report.redacted, null)
})

test('json report carries hosts, database and ssl mode through unchanged', () => {
  const info = parseConnectionString('redis://[::1]:6379/0?ssl=true')
  const report = formatJson(info)
  assert.deepEqual(report.hosts, [{ host: '::1', port: '6379' }])
  assert.equal(report.database, '0')
  assert.equal(report.sslMode, 'true')
})

test('json report carries mongodb+srv warnings through', () => {
  const info = parseConnectionString('mongodb+srv://appuser:hunter2@cluster0.internal:27017/orders')
  const report = formatJson(info)
  assert.equal(report.warnings.length, 2)
})

test('text report prints a warning line for each srv warning', () => {
  const info = parseConnectionString('mongodb+srv://appuser:hunter2@cluster0.internal/orders')
  const text = formatReport(info)
  assert.match(text, /warning:    mongodb\+srv defaults to TLS enabled/)
})

test('text report has no warning lines for a plain url', () => {
  const info = parseConnectionString('postgres://appuser:hunter2@db.internal/orders')
  const text = formatReport(info)
  assert.equal(text.includes('warning:'), false)
})
