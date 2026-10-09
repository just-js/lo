// throws during synchronous evaluation
globalThis.lo_test_throws_runs = (globalThis.lo_test_throws_runs || 0) + 1
export const x = 1
throw new Error('throws')
