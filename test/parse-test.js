// usage: lo /abs/path/parse-test.js <file.js | runtime/name.config.js>
//
// For a runtime config: with an index and no main, the runtime runs lo's
// main.js, so scan main.js and the index. With main overridden, scan only
// main. Then compare against the bindings/libs in the config.
import { parse } from 'lib/parse.js'

const PLATFORMS = ['linux', 'mac', 'win']

function binding_entries (bindings) {
  const map = new Map()
  for (const b of bindings) {
    if (typeof b === 'string') {
      map.set(b, PLATFORMS)
      continue
    }
    const name = Object.keys(b)[0]
    map.set(name, b[name])
  }
  return map
}

function merge_results (results) {
  const bindings = new Map()
  const libs = new Set()
  const warnings = []
  for (const r of results) {
    for (const [name, platforms] of binding_entries(r.bindings)) {
      const current = bindings.get(name) || []
      bindings.set(name, PLATFORMS.filter(p => current.includes(p) || platforms.includes(p)))
    }
    r.libs.forEach(l => libs.add(l))
    warnings.push(...r.warnings)
  }
  return {
    bindings: Array.from(bindings).map(([name, platforms]) =>
      platforms.length === PLATFORMS.length ? name : { [name]: platforms }),
    libs: Array.from(libs),
    warnings
  }
}

function show (label, list) {
  console.log(`${label}:`)
  for (const item of list) console.log(`  ${JSON.stringify(item)}`)
}

const [file_name] = lo.args.slice(2)
if (!file_name) throw new Error('usage: parse-test.js <file.js | name.config.js>')

if (file_name.endsWith('.config.js')) {
  const path = file_name[0] === '/' ? file_name : `${lo.getcwd()}/${file_name}`
  const config = (await import(path)).default
  const entries = config.main ? [config.main] : ['main.js', config.index]
  console.log(`scanning ${entries.join(', ')}`)
  const result = merge_results(await Promise.all(entries.map(e => parse(e))))
  show('bindings', result.bindings)
  show('libs', result.libs)
  show('warnings', result.warnings)
  const found_b = new Set(binding_entries(result.bindings).keys())
  const config_b = new Set(binding_entries(config.bindings).keys())
  const found_l = new Set(result.libs)
  const config_l = new Set(config.libs)
  console.log('compared to config:')
  show('  bindings missing from config', [...found_b].filter(b => !config_b.has(b)))
  show('  bindings in config, not found', [...config_b].filter(b => !found_b.has(b)))
  show('  libs missing from config', [...found_l].filter(l => !config_l.has(l)))
  show('  libs in config, not found', [...config_l].filter(l => !found_l.has(l)))
} else {
  const result = await parse(file_name)
  show('bindings', result.bindings)
  show('libs', result.libs)
  show('warnings', result.warnings)
}
