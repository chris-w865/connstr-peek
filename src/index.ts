#!/usr/bin/env node
import { parseConnectionString } from './parse.js'
import { formatReport, formatJson } from './format.js'

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
  const arg = args.find((a) => a !== '--json')
  let input: string

  if (arg) {
    input = arg
  } else if (!process.stdin.isTTY) {
    input = await readStdin()
  } else {
    console.error('usage: connpeek [--json] <connection-string>')
    console.error('   or: echo "<connection-string>" | connpeek [--json]')
    process.exitCode = 1
    return
  }

  const info = parseConnectionString(input)
  console.log(json ? JSON.stringify(formatJson(info), null, 2) : formatReport(info))
}

main()
