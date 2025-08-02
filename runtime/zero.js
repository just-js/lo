const handle = new Uint32Array(2)

function hrtime () {
  lo.hrtime(handle)
  return handle[0] + ((2 ** 32) * handle[1])
}

lo.print(`${hrtime() - lo.start}\n`)
lo.print(`${Object.getOwnPropertyNames(lo)}\n`)