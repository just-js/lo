import { run } from 'lib/bench.js'
import { Digest } from 'lib/hash.js'

const { assert, cstr } = spin

const md5 = new Digest('md5')

const hello = cstr('hello')
const expected = [ 93, 65, 64, 42, 188, 75, 42, 118, 185, 113, 157, 145, 16, 23, 197, 146 ]
const expectedsha256 = [ 44,242,77,186,95,176,163,14,38,232,59,42,197,185,226,158,27,22,30,92,31,167,66,94,115,4,51,98,147,139,152,36 ]

md5.hashString('hello').forEach((v, i) => assert(v === expected[i]))
md5.hash(hello).forEach((v, i) => assert(v === expected[i]))
//md5.hashonce(hello).forEach((v, i) => assert(v === expected[i]))

//run('hash', () => md5.hash(hello), 12000000, 20)
run('hashString', () => md5.hashString('hello'), 12000000, 20)
//run('hashonce', () => md5.hashonce(hello), 12000000, 20)
//run('hashString2', () => md5.hashString2(hello), 12000000, 20)
