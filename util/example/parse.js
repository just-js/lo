import { readFile } from 'lib/fs.js'

const decoder = new TextDecoder()

function require (fileName) {
  const code = decoder.decode(readFile(fileName))
  const f = new Function('exports', 'module', 'require', code)
  const mod = { exports: {} }
  f.call(globalThis, mod.exports, mod, require)
  return mod.exports
}

const acorn = require('./lib/acorn.js')

const scriptPath = spin.args[2] || './util/example/sniproxy.js'
const src = decoder.decode(readFile(scriptPath))

const tokens = []
const imports = []

acorn.parse(src, {
  ecmaVersion: 2022,
  sourceType: 'module',
  onToken: token => {
    tokens.push(token)
    if (token.value === 'from') {
      imports.push(tokens.length)
    } else if (token.value === 'load' || token.value === 'library') {
      imports.push(tokens.length + 1)
    }
  }
})
console.log(JSON.stringify(tokens.map(t => t.value)))

for (const index of imports) {
  console.log(`${tokens[index].value}, ${tokens.slice(index - 10 < 0 ? 0 : index - 10, index).map(t => t.value)}`)
/*
  const idx = index
  const stmt = []
  for (let i = 0; i < 100; i++) {
    if (idx - i < 0) break
    const { value } = tokens[idx - i]
    if (value) stmt.unshift(value)
    if (tokens[idx] === 'from') {
      if (value === 'import' || value === 'const') {
        break
      }
    } else if (tokens[idx] === 'load' || tokens[idx] === 'library') {
      if (value === 'const') {
        break
      }
    }
  }
  console.log(stmt)
*/
}
