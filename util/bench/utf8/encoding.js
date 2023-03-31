import { run } from '../../../lib/bench.js'

const encoder = new TextEncoder()

run('utf8encode', () => encoder.encode('hello'), 30000000, 10)
