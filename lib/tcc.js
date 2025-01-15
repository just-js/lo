//import * as asm from 'lib/asm.js'
//import { dump } from 'lib/binary.js'

const { tcc } = lo.load('tcc')
const { assert, wrap } = lo
//const { assert, wrap, register_callback, core, ptr, utf8_decode } = lo
//const { dlsym, strnlen } = core

const TCC_OUTPUT_MEMORY = 1
const TCC_RELOCATE_AUTO = 1

tcc.constants = {
  TCC_OUTPUT_MEMORY, TCC_RELOCATE_AUTO
}

const handle = new Uint32Array(2)
tcc.create = wrap(handle, tcc.create, 0)
tcc.get_symbol = wrap(handle, tcc.get_symbol, 2)

/*
const assembler = new asm.Assembler()
const { rax, rdi, rsi, rdx } = asm.Registers
const C_compiler = new asm.Compiler()
*/

class Compiler {
//  #ctx = ptr(new Uint8Array(0))
//  #callback_address = 0
//  #cb_wrapper = 0

  constructor () {
    this.compiler = tcc.create()
    assert(this.compiler)
  }

  compile (src, relocate = true) {
    assert(this.compiler)
    const { compiler } = this
    tcc.set_output_type(compiler, TCC_OUTPUT_MEMORY)
    let rc = tcc.compile_string(compiler, src)
    assert(rc === 0, `could not compile (${rc})`)
/*
    const nArgs = 3
    this.#ctx = ptr(new Uint8Array(((nArgs + 3) * 8)))
    this.#callback_address = assert(dlsym(0, 'lo_callback'))
    const dv = new DataView(this.#ctx.buffer)
    register_callback(this.#ctx.ptr, () => {
      const str_ptr = Number(dv.getBigUint64(32, true))
      const str_len = strnlen(str_ptr, 1024)
      console.log(utf8_decode(str_ptr, str_len))
      console.log(dump(this.#ctx))
    })
    assembler.reset()
    assembler.movabs(this.#ctx.ptr, rax)
    assembler.movdest(rdi, rax, 24)
    assembler.movreg(rax, rdi)
    assembler.movdest(rsi, rax, 32)
    assembler.movdest(rdx, rax, 40)
    assembler.call(this.#callback_address)
    assembler.ret()
    this.#cb_wrapper = assert(C_compiler.compile(assembler.bytes()))
*/
    if (relocate) this.relocate()
  }

  options (str) {
    assert(this.compiler)
    const { compiler } = this
    tcc.set_options(compiler, str)
  }

  libs (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.add_library(compiler, path) === 0)
  }

  paths (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.add_library_path(compiler, path) === 0)
  }

  files (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.add_file(compiler, path) === 0)
  }

  includes (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.add_include_path(compiler, path) === 0)
  }

  relocate () {
    assert(this.compiler)
    const { compiler } = this
    const rc = tcc.relocate(compiler, TCC_RELOCATE_AUTO)
    assert(rc === 0, `could not relocate (${rc})`)
  }

  symbol (name) {
    assert(this.compiler)
    return tcc.get_symbol(this.compiler, name)
  }
/*
  symbols (cb) {
    tcc.list_symbols(this.compiler, 0, this.#cb_wrapper)
  }
*/
  add (name, address) {
    assert(address)
    return tcc.add_symbol(this.compiler, name, address)
  }
}

export { Compiler, tcc }
