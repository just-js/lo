import { Tokenizer } from 'lib/html.js'

const showdown = require('./lib/showdown.js')

const { readFile } = spin.fs
const { Converter } = showdown

const converter = new Converter()
converter.setOption('tables', true)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function markdown (directive) {
  const { value } = directive
  const fileName = `${this.root}${value}`
  const template = readFile(fileName)
  const html = converter.makeHtml(decoder.decode(template))
  const tokenizer = new Tokenizer()
  tokenizer.tokenize(encoder.encode(html))
  for (const token of tokenizer.tokens) this.parse(token)
}

export { markdown }

