export interface HostPort {
  host: string
  port: string | null
}

export interface ConnectionInfo {
  raw: string
  scheme: string | null
  hosts: HostPort[]
  database: string | null
  user: string | null
  hasPassword: boolean
  sslMode: string | null
  params: Record<string, string>
  format: 'url' | 'keyvalue' | 'unknown'
  warnings: string[]
}

const SSL_KEYS = ['sslmode', 'ssl', 'ssl_mode', 'encrypt', 'tls']

export function parseConnectionString(input: string): ConnectionInfo {
  const raw = input.trim()

  if (looksLikeKeyValue(raw)) {
    return parseKeyValue(raw)
  }

  // jdbc:postgresql://host/db reports the real driver as its scheme,
  // so strip the jdbc: prefix before parsing and reattach it after
  let working = raw
  let jdbc = false
  if (working.startsWith('jdbc:')) {
    working = working.slice('jdbc:'.length)
    jdbc = true
  }

  if (working.includes('://')) {
    const info = parseUrlStyle(working, raw)
    if (jdbc && info.scheme) info.scheme = `jdbc:${info.scheme}`
    return info
  }

  return {
    raw,
    scheme: null,
    hosts: [],
    database: null,
    user: null,
    hasPassword: false,
    sslMode: null,
    params: {},
    format: 'unknown',
    warnings: [],
  }
}

function looksLikeKeyValue(raw: string): boolean {
  // ODBC/ADO.NET style: "Key=Value;Key2=Value2" with no scheme separator
  return !raw.includes('://') && raw.includes('=') && raw.includes(';')
}

function parseKeyValue(raw: string): ConnectionInfo {
  const pairs: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim().toLowerCase()
    const value = trimmed.slice(eqIndex + 1).trim()
    pairs[key] = value
  }

  const host = pairs['server'] ?? pairs['host'] ?? pairs['data source'] ?? null
  const port = pairs['port'] ?? null
  const database = pairs['database'] ?? pairs['initial catalog'] ?? pairs['db'] ?? null
  const user = pairs['user id'] ?? pairs['uid'] ?? pairs['user'] ?? pairs['username'] ?? null
  const hasPassword = Boolean(pairs['password'] ?? pairs['pwd'])

  let sslMode: string | null = null
  for (const key of SSL_KEYS) {
    if (pairs[key] !== undefined) {
      sslMode = pairs[key]
      break
    }
  }

  const known = new Set([
    'server', 'host', 'data source', 'port', 'database', 'initial catalog', 'db',
    'user id', 'uid', 'user', 'username', 'password', 'pwd',
    ...SSL_KEYS,
  ])
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(pairs)) {
    if (!known.has(key)) params[key] = value
  }

  return {
    raw,
    scheme: null,
    hosts: host ? [{ host, port }] : [],
    database,
    user,
    hasPassword,
    sslMode,
    params,
    format: 'keyvalue',
    warnings: [],
  }
}

function parseUrlStyle(working: string, raw: string): ConnectionInfo {
  const schemeEnd = working.indexOf('://')
  const scheme = working.slice(0, schemeEnd)
  let rest = working.slice(schemeEnd + 3)

  let user: string | null = null
  let hasPassword = false

  const atIndex = rest.lastIndexOf('@')
  if (atIndex !== -1) {
    const credentials = rest.slice(0, atIndex)
    rest = rest.slice(atIndex + 1)
    const colonIndex = credentials.indexOf(':')
    if (colonIndex !== -1) {
      user = decodeSafe(credentials.slice(0, colonIndex))
      hasPassword = credentials.slice(colonIndex + 1).length > 0
    } else if (credentials.length > 0) {
      user = decodeSafe(credentials)
    }
  }

  let hostSection = rest
  let pathAndQuery = ''
  const slashIndex = rest.indexOf('/')
  if (slashIndex !== -1) {
    hostSection = rest.slice(0, slashIndex)
    pathAndQuery = rest.slice(slashIndex + 1)
  }

  const hosts = hostSection
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(splitHostPort)

  let database: string | null = null
  let query = ''
  const queryIndex = pathAndQuery.indexOf('?')
  if (queryIndex !== -1) {
    database = pathAndQuery.slice(0, queryIndex) || null
    query = pathAndQuery.slice(queryIndex + 1)
  } else {
    database = pathAndQuery || null
  }

  const params: Record<string, string> = {}
  let sslMode: string | null = null
  if (query) {
    for (const pair of query.split('&')) {
      if (!pair) continue
      const eqIndex = pair.indexOf('=')
      const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex)
      const rawValue = eqIndex === -1 ? '' : pair.slice(eqIndex + 1)
      const key = decodeSafe(rawKey).toLowerCase()
      const value = decodeSafe(rawValue)
      if (SSL_KEYS.includes(key)) {
        sslMode = value
      } else {
        params[key] = value
      }
    }
  }

  return {
    raw,
    scheme,
    hosts,
    database: database ? decodeSafe(database) : null,
    user,
    hasPassword,
    sslMode,
    params,
    format: 'url',
    warnings: scheme === 'mongodb+srv' ? mongoSrvWarnings(hosts, sslMode) : [],
  }
}

// mongodb+srv doesn't carry a real host list — the driver resolves the actual
// hosts (and their port, normally 27017) from a DNS SRV record at connect time,
// and TLS defaults to on unless ssl=false is set explicitly. None of that is
// visible from the string alone, so surface it instead of silently parsing it
// like an ordinary multi-host url.
function mongoSrvWarnings(hosts: HostPort[], sslMode: string | null): string[] {
  const warnings: string[] = []
  if (hosts.length !== 1) {
    warnings.push(
      'mongodb+srv takes exactly one hostname; the real host list comes from a DNS SRV lookup at connect time, not from this string',
    )
  }
  if (hosts.some((h) => h.port !== null)) {
    warnings.push('mongodb+srv hostnames do not take a port — the port comes from the SRV record')
  }
  if (sslMode === null) {
    warnings.push('mongodb+srv defaults to TLS enabled unless overridden with ssl=false')
  }
  return warnings
}

function splitHostPort(part: string): HostPort {
  // IPv6 literal, e.g. [::1]:5432
  if (part.startsWith('[')) {
    const closeIndex = part.indexOf(']')
    const host = part.slice(1, closeIndex)
    const remainder = part.slice(closeIndex + 1)
    const port = remainder.startsWith(':') ? remainder.slice(1) : null
    return { host, port }
  }
  const colonIndex = part.lastIndexOf(':')
  if (colonIndex === -1) return { host: part, port: null }
  return { host: part.slice(0, colonIndex), port: part.slice(colonIndex + 1) }
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
