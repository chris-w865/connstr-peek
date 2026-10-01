#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseConnectionString } from './parse.js'
import { formatReport, formatJson, checkStatus } from './format.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const USAGE = [
  'usage: connpeek [--json] [--check-only] <connection-string>',
  '   or: echo "<connection-string>" | connpeek [--json] [--check-only]',
  '',
  'options:',
  '  --json         print structured output',
  '  --check-only   print nothing on success; exit 0 clean, 1 warnings, 2 not recognized',
  '  --version, -v  print the version',
  '  --help, -h     print this message',
].join('\n')

const KNOWN_FLAGS = new Set(['--json', '--check-only', '--version', '-v', '--help', '-h'])

function readVersion(): string {
  // dist/index.js sits one level below package.json, same as src/index.ts.
  const path = fileURLToPath(new URL('../package.json', import.meta.url))
  return JSON.parse(readFileSync(path, 'utf8')).version
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE)
    return
  }
  if (args.includes('--version') || args.includes('-v')) {
    console.log(readVersion())
    return
  }

  // A connection string never starts with a dash, so an unknown dashed
  // argument is a mistyped flag and not something to parse.
  const unknown = args.find((a) => a.startsWith('-') && !KNOWN_FLAGS.has(a))
  if (unknown) {
    console.error(`connpeek: unknown option ${unknown}`)
    console.error(USAGE)
    process.exitCode = 2
    return
  }

  const json = args.includes('--json')
  const checkOnly = args.includes('--check-only')
  const arg = args.find((a) => !a.startsWith('-'))
  let input: string

  if (arg) {
    input = arg
  } else if (!process.stdin.isTTY) {
    input = await readStdin()
  } else {
    console.error(USAGE)
    process.exitCode = 1
    return
  }

  const info = parseConnectionString(input)

  if (checkOnly) {
    const result = checkStatus(info)
    if (result.reason) console.error(result.reason)
    process.exitCode = result.code
    return
  }

  console.log(json ? JSON.stringify(formatJson(info), null, 2) : formatReport(info))
}

main()
