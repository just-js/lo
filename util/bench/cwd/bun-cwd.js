import { run } from './lib/bench.js'

const { cwd } = process

console.log(cwd())

run('cwd', cwd, 2000000, 20)
