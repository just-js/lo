import { run } from '../../../lib/bench.js'

const encoder = new TextEncoder()
const hello = encoder.encode('hello')

const expected = [ 93, 65, 64, 42, 188, 75, 42, 118, 185, 113, 157, 145, 16, 23, 197, 146 ]
Bun.MD5.hash(hello).some((v, i) => assert(v === expected[i]))

const { hash } = Bun.MD5

//run('md5-string', () => hash('hello'), 4000000, 5)
run('md5-buffer', () => hash(hello), 12000000, 20)
