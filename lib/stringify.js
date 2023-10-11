const AD = '\u001b[0m' // ANSI Default
const A0 = '\u001b[30m' // ANSI Black
const AR = '\u001b[31m' // ANSI Red
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow
const AB = '\u001b[34m' // ANSI Blue
const AM = '\u001b[35m' // ANSI Magenta
const AC = '\u001b[36m' // ANSI Cyan
const AW = '\u001b[37m' // ANSI White

/**
 * Stringify replacement for pretty printing JS objects
 */

let memo = new Map()

function replacer (k, v) {
  if (typeof v === 'object') {
    if (memo.has(v)) return
    memo.set(v)
  }
  if (typeof v === 'bigint') {
    return Number(v)
  }
  if (!v) {
    if (typeof v !== 'boolean' && typeof v !== 'number') return '<empty>'
  }
  if (v.constructor && v.constructor.name === 'Error') {
    return { message: v.message, stack: v.stack }
  }
  if (v.constructor && v.constructor.name === 'ArrayBuffer') {
    return 'ArrayBuffer ' + v.byteLength
  }
  if (v.constructor && v.constructor.name === 'Uint8Array') {
    return 'Uint8Array ' + v.length
  }
  if (v.constructor && v.constructor.name === 'Uint32Array') {
    return 'Uint32Array ' + v.length
  }
  if (v.constructor && v.constructor.name === 'DataView') {
    return 'DataView ' + v.byteLength
  }
  if (v.constructor && v.constructor.name === 'Function') {
    return `${v.name} (...${v.length})` 
  }
  if (v.constructor && v.constructor.name === 'AsyncFunction') {
    return `async ${v.name} (...${v.length})` 
  }
  return v
}

const stringify = (o, sp = '  ') => {
  memo = new Map()
  const text = JSON.stringify(o, replacer, sp)
  if (!text) return
  return text.replace(/\s{8}"(.+)":/g, `        ${AB}$1${AD}:`)
    .replace(/\s{6}"(.+)":/g, `      ${AC}$1${AD}:`)
    .replace(/\s{4}"(.+)":/g, `    ${AG}$1${AD}:`)
    .replace(/\s\s"(.+)":/g, `  ${AY}$1${AD}:`)
    .replace(/([{}])/g, `${AM}$1${AD}`)
    .replace(/\[(.+)\]/g, `${AG}[${AD}$1${AG}]${AD}`)
    .replace(/"<empty>"/g, `${AC}<empty>${AD}`)
    .replace(/"<repeat>"/g, `${AC}<repeat>${AD}`)
}

export { stringify }
