import { run } from '../../../lib/bench.js'
import { createHash } from 'node:crypto'

const encoder = new TextEncoder()
const hello = encoder.encode('hello')

function md5 (buf) {
  return createHash('md5').update(buf).digest()
}

const digest = md5(hello)
const expected = [ 93, 65, 64, 42, 188, 75, 42, 118, 185, 113, 157, 145, 16, 23, 197, 146 ]
digest.some((v, i) => assert(v === expected[i]))

run('md5', () => md5(hello), 1200000, 20)
