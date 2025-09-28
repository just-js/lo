function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])  
}

function get_address (buf) {
  lo.getAddress(buf, handle)
  return addr(handle)
}

function hrtime () {
  lo.hrtime(handle.ptr)
  return addr(handle)
}

const handle = new Uint32Array(2)
handle.ptr = get_address(handle)

lo.print(`${hrtime() - lo.start}\n`)
