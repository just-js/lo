import { spawn, join, pthread } from 'lib/thread.js'

const { core, utf8Length, assert, cstr, ptr, little_endian } = lo
const {
  isolate_context_create, isolate_context_size, isolate_context_destroy, dlsym,
  RTLD_DEFAULT
} = core

const { EBUSY, tryJoin } = pthread

// TODO: this is nasty - clean it up
function makeArgs (args) {
  const argb = new Array(args.length)
  if (!args.length) return { args: new Uint8Array(0) }
  const b64 = new BigUint64Array(args.length + 1)
  for (let i = 0; i < args.length; i++) {
    const str = argb[i] = cstr(args[i])
    // @ts-ignore
    b64[i] = BigInt(str.ptr)
  }
  return {
    args: ptr(new Uint8Array(b64.buffer)),
    cstrings: argb
  }
}

class Worker {
  script_path = 'main.js'
  #initialized = false

  constructor (script, args = [], runtime = lo.builtin('main.js')) {
    this.script = script
    this.context = ptr(new Uint8Array(isolate_context_size()))
    this.view = new DataView(this.context.buffer)
    this.argv = makeArgs(args)
    this.argc = args.length
    this.runtime = runtime
    this.tid = 0
    this.exit_code = 0
    this.cleanup = 1
    this.onexit = 0
    this.snapshot = 0
    this.rc = 0
  }

  create (fd = 0, buf, buflen = buf.length) {
    const { argc, argv, context, runtime, script, script_path, cleanup, onexit, snapshot } = this
    if (buf.buffer) {
      // todo: keep track of this buffer
      if (!buf.ptr) buf = ptr(buf)
      isolate_context_create(argc, argv.args.ptr, runtime, utf8Length(runtime), script, 
        utf8Length(script), buf ? buf.ptr : 0, buf ? buf.length : 0, fd, lo.hrtime(), 'lo', 
        script_path, cleanup, onexit, snapshot, context)
    } else {
      // todo: keep track of this pointer
      isolate_context_create(argc, argv.args.ptr, runtime, utf8Length(runtime), script, 
        utf8Length(script), buf || 0, buflen || 0, fd, lo.hrtime(), 'lo', 
        script_path, cleanup, onexit, snapshot, context)
    }
    this.#initialized = true
    return this
  }

  start () {
    if (!this.#initialized) return
    this.tid = spawn(start_isolate_address, this.context)
    return this
  }

  waitfor () {
    if (!this.tid || !this.#initialized) return -1
    this.rc = join(this.tid)
    this.exit_code = this.view.getUint32(0, little_endian)
    return this
  }

  poll () {
    if (!this.tid || !this.#initialized) return true
    if (tryJoin(this.tid, rcbuf.ptr) === EBUSY) return true
    return false
  }

  free () {
    isolate_context_destroy(this.context)
    this.#initialized = false
    return this
  }

  stop () {
    pthread.cancel(this.tid)
    return this
  }
}

const rcbuf = ptr(new Uint32Array(2))
const start_isolate_address = assert(dlsym(RTLD_DEFAULT, 'lo_start_isolate'))

export { Worker }
