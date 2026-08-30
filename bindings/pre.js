import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const url = `https://raw.githubusercontent.com/v8/v8/refs/tags/${process.versions.v8.substring(0, process.versions.v8.indexOf('-'))}/include/v8-fast-api-calls.h`
const response = await fetch(url)
if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
const content = await response.text()
if (!content.includes('#ifndef INCLUDE_V8_FAST_API_CALLS_H_') || !content.includes('namespace v8')) {
  throw new Error(`Integrity check failed for v8-fast-api-calls.h (sha256: ${createHash('sha256').update(content).digest('hex')})`)
}
writeFileSync(`v8-fast-api-calls.h`, content)
