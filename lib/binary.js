import { colors } from 'lib/ansi.js'

const { AD, AG, AC } = colors

function dump (bytes, len = bytes.length, off = 0, width = 16, pos = 0, decimal = false) {
  const result = []
  const chars = []
  const base = decimal ? 10 : 16
  for (let i = 0; i < len; i++) {
    if (i % width === 0) {
      if (i === 0) {
        result.push('')
      } else {
        result.push(` ${chars.join('')}\n`)
        chars.length = 0
      }
    }
    const boff = i + off
    if (i % 8 === 0) {
      result.push(`${AG}${(boff).toString(base).padStart(5, ' ')}${AD}`)
    }
    result.push(` ${bytes[boff].toString(16).padStart(2, '0')}`)
    if (bytes[boff] >= 32 && bytes[boff] <= 126) {
      chars.push(`${AC}${String.fromCharCode(bytes[boff])}${AD}`)
    } else {
      chars.push('.')
    }
  }
  const remaining = width - (len % width)
  if (remaining === width) {
    result.push(` ${chars.join('')}\n`)
  } else if (remaining < 8) {
    result.push(`${'   '.repeat(remaining)} ${chars.join('')}\n`)
  } else {
    result.push(`${'   '.repeat(remaining)}      ${chars.join('')}\n`)
  }
  return result.join('')
}

export { dump }
