#!/usr/bin/env node
import { parseConnectionString } from './parse.js'
import { formatReport } from './format.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const arg = process.argv[2]
  let input: string

  if (arg) {
    input = arg
  } else if (!process.stdin.isTTY) {
    input = await readStdin()
  } else {
    console.error('usage: connpeek <connection-string>')
    console.error('   or: echo "<connection-string>" | connpeek')
    process.exitCode = 1
    return
  }

  const info = parseConnectionString(input)
  console.log(formatReport(info))
}

main()
