import { Bench } from 'lib/bench.js'

const { encode } = lo.load('encode')
const { encode_abi } = lo.load('encode_abi')

const { assert, core } = lo
const { dlopen, dlsym, RTLD_NOW, RTLD_LOCAL } = core

const bench = new Bench()
const iter = 5

{
  const runs = 500000000

  for (let i = 0; i < iter; i++) {
    bench.start('encode.test')
    for (let j = 0; j < runs; j++) assert(encode.test() === 1)
    bench.end(runs)
  }
}

{
  const runs = 500000000

  for (let i = 0; i < iter; i++) {
    bench.start('encode_abi')
    for (let j = 0; j < runs; j++) assert(encode_abi.test() === 1)
    bench.end(runs)
  }
}
