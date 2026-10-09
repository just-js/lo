// Static dependency scanner for lo programs. Parses a js file with acorn,
// follows every import (static, re-export and string-literal dynamic
// import()) that resolves to a file, and collects the bindings loaded via
// lo.load('x') / lo.library('x') (or bare load/library) along the way.
//
// Bindings loaded under a platform guard (os === 'mac', core.os !== 'win',
// lo.core.os === 'linux' ? ... etc.) are returned tagged with the platforms
// they apply to, e.g. { epoll: ['linux'] }, the form build_runtime accepts.
// Code that can never run on lo is skipped: branches guarded by
// globalThis.lo (always true) or globalThis.Deno / globalThis.Bun (always
// false). Any other condition (getenv, globalThis.process ...) is treated as
// unknown, so both branches are included.
//
// Specifiers that don't resolve to a file and non-literal specifiers or
// binding names are reported in warnings.
import { parse as acorn_parse } from 'lib/acorn/acorn.js'
import { ancestor } from 'lib/acorn/walk.js'

const { core } = lo
const { isFile, read_file } = core

const PLATFORMS = ['linux', 'mac', 'win']
const LOADERS = ['load', 'library']
const decoder = new TextDecoder()

function normalize (path) {
  const abs = path[0] === '/'
  const parts = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..' && parts.length && parts[parts.length - 1] !== '..') {
      parts.pop()
      continue
    }
    if (part === '..' && abs) continue
    parts.push(part)
  }
  return `${abs ? '/' : ''}${parts.join('/')}`
}

function dir_name (path) {
  const i = path.lastIndexOf('/')
  return i < 0 ? '.' : path.slice(0, i)
}

// ---- platform guards ----

function is_os_ref (node) {
  if (node.type === 'Identifier') return node.name === 'os'
  return node.type === 'MemberExpression' && !node.computed &&
    node.property.name === 'os'
}

function is_platform (node) {
  return node.type === 'Literal' && PLATFORMS.includes(node.value)
}

const complement = set => set && PLATFORMS.filter(p => !set.includes(p))
const union = (a, b) => a && b && PLATFORMS.filter(p => a.includes(p) || b.includes(p))
const intersect = (a, b) => PLATFORMS.filter(p => a.includes(p) && b.includes(p))

// the platforms on which expr is true, or null if it doesn't constrain them
function when_true (expr) {
  switch (expr.type) {
    case 'BinaryExpression': {
      const { left, right, operator } = expr
      let platform
      if (is_os_ref(left) && is_platform(right)) platform = right.value
      else if (is_os_ref(right) && is_platform(left)) platform = left.value
      else return null
      if (operator === '===' || operator === '==') return [platform]
      if (operator === '!==' || operator === '!=') return complement([platform])
      return null
    }
    case 'LogicalExpression': {
      const left = when_true(expr.left)
      const right = when_true(expr.right)
      if (expr.operator === '||') return union(left, right)
      if (expr.operator === '&&') {
        if (left && right) return intersect(left, right)
        return left || right
      }
      return null
    }
    case 'UnaryExpression':
      return expr.operator === '!' ? when_false(expr.argument) : null
    case 'ParenthesizedExpression':
      return when_true(expr.expression)
  }
  return null
}

// the platforms on which expr is false, or null if it doesn't constrain them
function when_false (expr) {
  switch (expr.type) {
    case 'BinaryExpression':
      return complement(when_true(expr))
    case 'LogicalExpression': {
      const left = when_false(expr.left)
      const right = when_false(expr.right)
      if (expr.operator === '&&') return union(left, right)
      if (expr.operator === '||') {
        if (left && right) return intersect(left, right)
        return left || right
      }
      return null
    }
    case 'UnaryExpression':
      return expr.operator === '!' ? when_true(expr.argument) : null
    case 'ParenthesizedExpression':
      return when_false(expr.expression)
  }
  return null
}

// ---- runtime guards ----

// globalThis.<name> checks with a known answer when running on lo. process
// is deliberately absent: lib/bench.js assigns globalThis.process on lo.
const RUNTIME_GLOBALS = { lo: true, Deno: false, Bun: false }

// the root object of a (possibly optional) member chain, e.g.
// globalThis.Deno?.version.deno -> the globalThis.Deno node
function chain_root (node) {
  if (node.type === 'ChainExpression') node = node.expression
  while (node.type === 'MemberExpression' && node.object.type === 'MemberExpression') {
    node = node.object
  }
  return node
}

// true/false if expr's truthiness is known on lo, else undefined
function on_lo (expr) {
  switch (expr.type) {
    case 'MemberExpression':
    case 'ChainExpression': {
      const root = chain_root(expr)
      if (root.type !== 'MemberExpression' || root.computed) return undefined
      if (root.object.type !== 'Identifier' || root.object.name !== 'globalThis') return undefined
      const known = RUNTIME_GLOBALS[root.property.name]
      // globalThis.lo.x may be anything, but globalThis.Deno.x is still absent
      if (known === false || root === expr || root === expr.expression) return known
      return undefined
    }
    case 'UnaryExpression': {
      if (expr.operator === '!') {
        const value = on_lo(expr.argument)
        return value === undefined ? undefined : !value
      }
      return undefined
    }
    case 'LogicalExpression': {
      const left = on_lo(expr.left)
      const right = on_lo(expr.right)
      if (expr.operator === '&&') {
        if (left === false || right === false) return false
        if (left === true && right === true) return true
      } else if (expr.operator === '||') {
        if (left === true || right === true) return true
        if (left === false && right === false) return false
      }
      return undefined
    }
    case 'ParenthesizedExpression':
      return on_lo(expr.expression)
  }
  return undefined
}

// narrow platforms by every guard between the program root and the node.
// an empty result means the node never runs on lo.
function guarded (platforms, ancestors) {
  for (let i = 0; i < ancestors.length - 1; i++) {
    const parent = ancestors[i]
    const child = ancestors[i + 1]
    let test = null
    let branch
    if (parent.type === 'IfStatement' || parent.type === 'ConditionalExpression') {
      test = parent.test
      if (child === parent.consequent) branch = true
      else if (child === parent.alternate) branch = false
    } else if (parent.type === 'LogicalExpression' && child === parent.right) {
      test = parent.left
      if (parent.operator === '&&') branch = true
      else if (parent.operator === '||') branch = false
    }
    if (!test || branch === undefined) continue
    const known = on_lo(test)
    if (known !== undefined && known !== branch) return []
    const set = branch ? when_true(test) : when_false(test)
    if (set) platforms = intersect(platforms, set)
  }
  return platforms
}

// ---- scanning ----

function string_value (node) {
  if (!node) return null
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked
  }
  return null
}

function loader_name (callee) {
  if (callee.type === 'Identifier' && LOADERS.includes(callee.name)) {
    return callee.name
  }
  if (callee.type === 'MemberExpression' && !callee.computed &&
    callee.object.type === 'Identifier' && callee.object.name === 'lo' &&
    LOADERS.includes(callee.property.name)) {
    return `lo.${callee.property.name}`
  }
  return null
}

function location (file_name, node) {
  return `${file_name}:${node.loc.start.line}:${node.loc.start.column + 1}`
}

// returns { imports: [{ specifier, platforms }], bindings: [{ name, platforms }] }
function scan (src, file_name, platforms, warnings) {
  const ast = acorn_parse(src, {
    ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true,
    locations: true
  })
  const imports = []
  const bindings = []
  function add_import (node, source, ancestors) {
    const specifier = string_value(source)
    if (specifier === null) {
      warnings.push(`${location(file_name, node)} non-literal import specifier`)
      return
    }
    imports.push({ specifier, platforms: guarded(platforms, ancestors) })
  }
  ancestor(ast, {
    ImportDeclaration: (node, _, ancestors) => add_import(node, node.source, ancestors),
    ExportAllDeclaration: (node, _, ancestors) => add_import(node, node.source, ancestors),
    ExportNamedDeclaration: (node, _, ancestors) => {
      if (node.source) add_import(node, node.source, ancestors)
    },
    ImportExpression: (node, _, ancestors) => add_import(node, node.source, ancestors),
    CallExpression: (node, _, ancestors) => {
      const loader = loader_name(node.callee)
      if (!loader) return
      const name = string_value(node.arguments[0])
      if (name === null) {
        warnings.push(`${location(file_name, node)} non-literal ${loader}() argument`)
        return
      }
      bindings.push({ name, platforms: guarded(platforms, ancestors) })
    }
  })
  return { imports, bindings }
}

// resolve a specifier the way lo's loader does: absolute, relative to the
// importing file, or bare relative to root. returns [key, path] or null.
function resolve (specifier, importer, root) {
  let path
  if (specifier[0] === '/') {
    path = normalize(specifier)
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    path = normalize(`${dir_name(importer)}/${specifier}`)
  } else {
    path = normalize(`${root}/${specifier}`)
  }
  if (!isFile(path)) return null
  const key = path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path
  return [key, path]
}

function merge (map, key, platforms) {
  const current = map.get(key)
  if (!current) {
    map.set(key, platforms)
    return true
  }
  const merged = union(current, platforms)
  if (merged.length === current.length) return false
  map.set(key, merged)
  return true
}

async function parse (file_name, { root = lo.getcwd() } = {}) {
  root = normalize(root)
  const entry = normalize(file_name[0] === '/' ? file_name : `${root}/${file_name}`)
  const libs = new Map()
  const bindings = new Map()
  const warnings = []
  const sources = new Map()
  // a file is (re)scanned whenever it is reached on more platforms than before
  const queue = [[entry, PLATFORMS]]
  const reached = new Map([[entry, PLATFORMS]])
  while (queue.length) {
    const [path, platforms] = queue.shift()
    if (!sources.has(path)) sources.set(path, decoder.decode(read_file(path)))
    let result
    try {
      result = scan(sources.get(path), path, platforms, warnings)
    } catch (err) {
      throw new Error(`${path}: ${err.message}`)
    }
    for (const b of result.bindings) {
      if (b.platforms.length) merge(bindings, b.name, b.platforms)
    }
    for (const i of result.imports) {
      if (!i.platforms.length) continue
      const resolved = resolve(i.specifier, path, root)
      if (!resolved) {
        warnings.push(`${path} unresolved import '${i.specifier}'`)
        continue
      }
      const [key, dep] = resolved
      if (dep !== entry) merge(libs, key, i.platforms)
      if (merge(reached, dep, i.platforms)) queue.push([dep, reached.get(dep)])
    }
  }
  return {
    bindings: Array.from(bindings).map(([name, platforms]) => {
      if (platforms.length === PLATFORMS.length) return name
      return { [name]: platforms }
    }),
    libs: Array.from(libs.keys()),
    warnings
  }
}

export { parse }
