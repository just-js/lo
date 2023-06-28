import { run } from 'lib/bench.js'

const { system } = spin.load('system')

const { getrusage } = system

const memUsage = () => {
  return getrusage()[0]
}

console.log(memUsage())

run('memUsage', memUsage, 1600000, 10)

console.log(memUsage())
