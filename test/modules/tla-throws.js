// throws after its top-level await
await import('lib/path.js')
throw new Error('tla-throws')
