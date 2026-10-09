// top-level await, then exports and a global: import() must not resolve
// before both exist
await import('lib/path.js')
globalThis.lo_test_tla_runs = (globalThis.lo_test_tla_runs || 0) + 1
export const ready = 'ready'
