import { baseName } from 'lib/path.js'

const { read_file } = lo.core

const rx = [
  [/`/g, '&#96;'], // replace backticks
  [/\$\{([^}]+)\}/g, '&dollar;{$1}'], // replace literal variables - ${x}
  [/\n?\s+?([<{])/g, '$1']
]

function sanitize (str, removeWhiteSpace = false) {
  if (removeWhiteSpace) {
    return str.trim()
      .replace(rx[2][0], rx[2][1])
      .replace(rx[0][0], rx[0][1])
      .replace(rx[1][0], rx[1][1])
  }
  return str
    .replace(rx[0][0], rx[0][1])
    .replace(rx[1][0], rx[1][1])
}

const decoder = new TextDecoder()

class Tokenizer {
  constructor () {
    this.tokens = []
  }

  tokenize (u8) {
    let inDirective = false
    let inName = false
    let name = []
    let last = ''
    let directive
    let start = 0
    let end = 0
    for (const b of u8) {
      const c = String.fromCharCode(b)
      if (inDirective) {
        if (c === '}' && last === '}') {
          if (name.length) {
            directive[directive.name ? 'value' : 'name'] = name.join('')
            name = []
          }
          this.tokens.push({ type: 'directive', value: directive })
          inDirective = false
          start = end + 1
        } else if (c !== '}') {
          if (inName) {
            if (c === ' ') {
              directive.name = name.join('')
              name = []
              inName = false
            } else {
              name.push(c)
            }
          } else {
            name.push(c)
          }
        }
      } else {
        if (c === '{' && last === '{') {
          if (end - start > 2) {
            this.tokens.push({ type: 'string', value: decoder.decode(u8.subarray(start, end - 1)) })
          }
          inDirective = true
          directive = {}
          inName = true
        }
      }
      last = c
      end++
    }
    if (end - start > 0) {
      this.tokens.push({ type: 'string', value: decoder.decode(u8.subarray(start, end)) })
    }
  }
}

class Parser {
  constructor (root = '', rawStrings = true) {
    this.source = []
    this.args = []
    this.command = ''
    this.depth = 0
    this.this = 'this'
    this.root = root
    this.rawStrings = rawStrings
    this.plugins = {}
  }

  start () {
    this.source = []
    this.args = []
    this.command = ''
    this.depth = 0
    this.this = 'this'
    this.source.push("let html = ''")
  }

  finish () {
    this.source.push('return html')
  }

  parse (token) {
    const { source } = this
    const { type } = token
    if (type === 'string') {
      if (this.rawStrings) {
        source.push(`html += String.raw\`${sanitize(token.value)}\``)
      } else {
        source.push(`html += "${sanitize(token.value, true)}"`)
      }
      return
    }
    const { name, value } = token.value
    if (name[0] === '#') {
      this.command = name.slice(1)
      if (this.command === 'template') {
        const fileName = `${this.root}${value}`
        const template = read_file(fileName)
        const tokenizer = new Tokenizer()
        tokenizer.tokenize(template)
        for (const token of tokenizer.tokens) {
          this.parse(token)
        }
        return
      }
      if (this.command === 'code') {
        source.push(`html += ${value}`)
        return
      }
      if (this.command === 'arg') {
        this.args.push(value)
        return
      }
      if (this.command === 'each') {
        this.depth++
        if (value === 'this') {
          source.push(`for (const v${this.depth} of ${value}) {`)
        } else {
          source.push(`for (const v${this.depth} of ${this.this}.${value}) {`)
        }
        this.this = `v${this.depth}`
        return
      }
      if (this.plugins[this.command]) {
        this.plugins[this.command].call(this, token.value)
        return
      }
      if (this.command === 'eachField') {
        this.depth++
        if (value === 'this') {
          source.push(`for (const v${this.depth} in ${value}) {`)
          source.push(`const name = v${this.depth}`)
          source.push(`const value = ${value}[v${this.depth}]`)
        } else {
          source.push(`for (const v${this.depth} in ${this.this}.${value}) {`)
          source.push(`const name = v${this.depth}`)
          source.push(`const value = ${this.this}.${value}[v${this.depth}]`)
        }
        this.this = ''
      }
      return
    }
    if (name[0] === '/') {
      const command = name.slice(1)
      if (command === 'each') {
        source.push('}')
        this.depth--
      }
      if (command === 'eachField') {
        source.push('}')
        this.depth--
      }
      this.command = ''
      this.this = 'this'
      return
    }
    if (this.this) {
      if (name === 'this') {
        source.push(`html += ${this.this}`)
      } else {
        const variable = name.split('.')[0]
        if (this.args.some(arg => arg === variable)) {
          source.push(`html += ${name}`)
        } else {
          source.push(`html += ${this.this}.${name}`)
        }
      }
    } else {
      source.push(`html += ${name}`)
    }
  }

  all (tokens) {
    this.start()
    for (const token of tokens) {
      this.parse(token)
    }
    this.finish()
  }
}

let index = 0

function compile (template, name = 'template', root = '', opts = {}) {
  const { plugins = {}, rawStrings } = opts
  const tokenizer = new Tokenizer()
  tokenizer.tokenize(template)
  const parser = new Parser(root, rawStrings)
  parser.plugins = plugins
  parser.all(tokenizer.tokens)
  const call = new Function(...parser.args, parser.source.join('\n'))
  return { call, tokenizer, parser, template }
}

function load (fileName, opts = { rawStrings: true, compile: true, plugins: {} }) {
  const template = read_file(fileName)
  if (template === -1) return
  if (opts.compile) return compile(template, fileName, baseName(fileName), opts).call
  return template
}

export { compile, load, Tokenizer, Parser, sanitize }
