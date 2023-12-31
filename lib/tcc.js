const { tcc } = lo.load('tcc')
const { assert, wrap } = lo

const TCC_OUTPUT_MEMORY = 1
const TCC_RELOCATE_AUTO = 1

tcc.constants = {
  TCC_OUTPUT_MEMORY, TCC_RELOCATE_AUTO
}

const handle = new Uint32Array(2)
tcc.tcc_new = wrap(handle, tcc.tcc_new, 0)
tcc.tcc_get_symbol = wrap(handle, tcc.tcc_get_symbol, 2)

class Compiler {
  constructor () {
    this.compiler = tcc.tcc_new()
    assert(this.compiler)
  }

  compile (src, relocate = true) {
    assert(this.compiler)
    const { compiler } = this
    tcc.tcc_set_output_type(compiler, TCC_OUTPUT_MEMORY)
    let rc = tcc.tcc_compile_string(compiler, src)
    assert(rc === 0, `could not compile (${rc})`)
    if (relocate) this.relocate()
  }

  options (str) {
    assert(this.compiler)
    const { compiler } = this
    tcc.tcc_set_options(compiler, str)
  }

  libs (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.tcc_add_library(compiler, path) === 0)
  }

  paths (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.tcc_add_library_path(compiler, path) === 0)
  }

  files (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.tcc_add_file(compiler, path) === 0)
  }

  includes (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.tcc_add_include_path(compiler, path) === 0)
  }

  relocate () {
    assert(this.compiler)
    const { compiler } = this
    const rc = tcc.tcc_relocate(compiler, TCC_RELOCATE_AUTO)
    assert(rc === 0, `could not relocate (${rc})`)
  }

  symbol (name) {
    assert(this.compiler)
    return tcc.tcc_get_symbol(this.compiler, name)
  }

  add (name, address) {
    assert(address)
    return tcc.tcc_add_symbol(this.compiler, name, address)
  }
}

export { Compiler, tcc }
