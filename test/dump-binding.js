import { system } from 'lib/system.js'

const { colors, assert, load } = lo
const { AD, AY, AC } = colors
const { strerror } = system

const name = lo.args[2]
const lib = assert(load(name), () => console.error(strerror()))
const binding = lib[name]

const entries = Object.entries(binding)
entries.sort((a, b) => a < b ? -1 : (a === b ? 0 : 1))
for (const [key, value] of entries) {
  if (['AsyncFunction', 'Function'].includes(value.constructor.name)) {
    console.log(`    ${AC}${key}${AD}: ${value.constructor.name} (${value.length})`)
  } else if (['Object'].includes(value.constructor.name)) {
    console.log(`    ${AC}${key}${AD}: ${value.constructor.name}`)
  } else {
    console.log(`    ${AY}${key}${AD}: ${value.constructor.name} = ${value}`)
  }
}
