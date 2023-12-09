import { api } from 'lib/libssl/api.js'

const { libssl } = lo.load('libssl')

const { wrap } = lo

const handle = new Uint32Array(2)

for (const name of Object.keys(api)) {
  const def = api[name]
  if (def.result === 'pointer' || def.result === 'u64') {
    libssl[name] = wrap(handle, libssl[name], def.parameters.length)
  }
}

export { libssl }
