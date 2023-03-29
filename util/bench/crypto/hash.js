import { run } from 'lib/bench.js'
import { Digest } from 'lib/hash.js'

const { assert } = spin

const md5 = new Digest('md5')

const encoder = new TextEncoder()
const hello = encoder.encode('hello')
const expected = [ 93, 65, 64, 42, 188, 75, 42, 118, 185, 113, 157, 145, 16, 23, 197, 146 ]

md5.hashString('hello').some((v, i) => assert(v === expected[i]))
md5.hash(hello).some((v, i) => assert(v === expected[i]))
md5.hashonce(hello).some((v, i) => assert(v === expected[i]))

run('hash', () => md5.hash(hello), 12000000, 20)
//run('hashString', () => md5.hashString('hello'), 12000000, 20)
//run('hashonce', () => md5.hashonce(hello), 12000000, 20)
