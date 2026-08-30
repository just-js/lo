// lib/foo_abi/foo_abi.cc — hand-written against lo_abi.h (WORK.E.1
// prototype, see doc/WORK.E.1.md), the way lib/gen.js would emit it once
// codegen targets the ABI instead of raw V8. Zero v8:: here by design —
// see lo_abi_v8.cc for the only place in this prototype allowed to touch
// V8 directly, and the LO_ABI_V8_BINDING(foo_abi) line that wires this
// binding's lo_register_foo_abi into the InitializerCallback convention
// main.js's load() expects.

#include "lo_abi.h"

void noop () {
}

static const lo_fn_desc_t foo_abi_fns[] = {
  { "noop", LO_VOID, nullptr, 0, (void*)noop, 0 },
};

LO_REGISTER(foo_abi) {
  return lo_register_functions(engine, exports, foo_abi_fns, 1);
}
