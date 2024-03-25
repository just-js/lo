let real_fetch

async function fetch (...args) {
  if (!real_fetch) {
    const curl = await import('lib/curl.js')
    real_fetch = curl.fetch
  }
  if (real_fetch) return real_fetch(...args)
  throw new Error('Not Supported')
}

export { fetch }

