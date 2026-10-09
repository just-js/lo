// a synchronous module that statically imports a top-level-await one
import { ready } from 'test/modules/tla.js'
export const via_static = `static ${ready}`
