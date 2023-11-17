const { AD, AG, AC } = lo.colors

function dump (u8, len = u8.length, off = 0, width = 16, pos = 0, decimal = false) {
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
    result.push(` ${u8[boff].toString(16).padStart(2, '0')}`)
    if (u8[boff] >= 32 && u8[boff] <= 126) {
      chars.push(`${AC}${String.fromCharCode(u8[boff])}${AD}`)
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
