import { run } from 'lib/bench.js'

run('errno', () => spin.errno ? 1 : 0, 10000000, 10)