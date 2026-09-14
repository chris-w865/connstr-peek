#!/usr/bin/env node
import { parseConnectionString } from './parse.js'
import { formatReport, formatJson, checkStatus } from './format.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const checkOnly = args.includes('--check-only')
  const arg = args.find((a) => a !== '--json' && a !== '--check-only')
  let input: string

  if (arg) {
    input = arg
  } else if (!process.stdin.isTTY) {
    input = await readStdin()
  } else {
    console.error('usage: connpeek [--json] [--check-only] <connection-string>')
    console.error('   or: echo "<connection-string>" | connpeek [--json] [--check-only]')
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
