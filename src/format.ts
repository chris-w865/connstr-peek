import { ConnectionInfo, HostPort } from './parse.js'

export function formatReport(info: ConnectionInfo): string {
  const lines: string[] = []

  if (info.format === 'unknown') {
    lines.push('could not recognize this as a connection string')
    lines.push('expected either scheme://... or Key=Value;Key2=Value2;...')
    return lines.join('\n')
  }

  lines.push(`format:     ${info.format}${info.scheme ? ` (${info.scheme})` : ''}`)

  if (info.hosts.length === 0) {
    lines.push('hosts:      none found')
  } else if (info.hosts.length === 1) {
    lines.push(`host:       ${formatHost(info.hosts[0])}`)
  } else {
    lines.push(`hosts:      ${info.hosts.length} found (failover / replica set)`)
    for (const host of info.hosts) {
      lines.push(`              - ${formatHost(host)}`)
    }
  }

  lines.push(`database:   ${info.database ?? '(none)'}`)
  lines.push(`user:       ${info.user ?? '(none)'}`)
  lines.push(`password:   ${info.hasPassword ? 'present (redacted)' : 'not set'}`)
  lines.push(`ssl:        ${info.sslMode ?? '(not specified — check driver default)'}`)

  const paramKeys = Object.keys(info.params)
  if (paramKeys.length > 0) {
    lines.push(`params:     ${paramKeys.map((k) => `${k}=${info.params[k]}`).join(', ')}`)
  }

  for (const warning of info.warnings) {
    lines.push(`warning:    ${warning}`)
  }

  lines.push('')
  lines.push(`redacted:   ${redact(info)}`)

  return lines.join('\n')
}

function formatHost(host: HostPort): string {
  return host.port ? `${host.host}:${host.port}` : host.host
}

export interface JsonReport {
  format: ConnectionInfo['format']
  scheme: string | null
  hosts: HostPort[]
  database: string | null
  user: string | null
  hasPassword: boolean
  sslMode: string | null
  params: Record<string, string>
  redacted: string | null
  warnings: string[]
}

export function formatJson(info: ConnectionInfo): JsonReport {
  return {
    format: info.format,
    scheme: info.scheme,
    hosts: info.hosts,
    database: info.database,
    user: info.user,
    hasPassword: info.hasPassword,
    sslMode: info.sslMode,
    params: info.params,
    redacted: info.format === 'unknown' ? null : redact(info),
    warnings: info.warnings,
  }
}

function redact(info: ConnectionInfo): string {
  if (info.format !== 'url') return '(redaction only supported for url-style strings)'
  return info.raw.replace(/:\/\/([^:@/]+):([^@/]+)@/, (_match, user) => `://${user}:***@`)
}
