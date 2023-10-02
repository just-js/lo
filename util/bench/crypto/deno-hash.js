import { Hash } from "https://deno.land/x/checksum@1.2.0/mod.ts";
import { run } from '../../../lib/bench.js'

const encoder = new TextEncoder()
const hello = encoder.encode('hello')

const expected = [ 93, 65, 64, 42, 188, 75, 42, 118, 185, 113, 157, 145, 16, 23, 197, 146 ]
const hash = new Hash('md5')

hash.digest(hello).data.forEach((v, i) => assert(v === expected[i]))

run('hashString', () => hash.digest(hello), 1200000, 20)
