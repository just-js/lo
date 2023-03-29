const { tcc } = spin.load('tcc')

const u32 = new Uint32Array(2)

function fromPtr () {
  return u32[0] + ((2 ** 32) * u32[1])  
}

const _tcc_get_symbol = tcc.tcc_get_symbol
tcc.tcc_get_symbol = (handle, pcstr) => {
  _tcc_get_symbol(handle, pcstr, u32)
  return fromPtr()
}

const _tcc_new = tcc.tcc_new
tcc.tcc_new = () => {
  _tcc_new(u32)
  return fromPtr()
}

const TCC_OUTPUT_MEMORY = 1
const TCC_RELOCATE_AUTO = 1

tcc.constants = {
  TCC_OUTPUT_MEMORY, TCC_RELOCATE_AUTO
}

export { tcc }
