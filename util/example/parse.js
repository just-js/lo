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
    if (token.value === 'load' || token.value === 'library' || token.value === 'from') {
      imports.push(tokens.length)
    }
  }
})


for (const index of imports) {
  const idx = index
  const stmt = []
  for (let i = 0; i < 100; i++) {
    if (idx - i < 0) break
    const { value } = tokens[idx - i]
    if (value) stmt.unshift(value)
    if (value === 'import' || value === 'const') {
      break
    }
  }
  console.log(stmt)
}
