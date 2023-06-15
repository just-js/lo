import * as mod1 from 'util/test/modules/mod1.js'
import * as mod2 from 'util/test/modules/mod2.js'
import * as mod3 from 'util/test/modules/mod1.js'
import * as mod4 from 'util/test/modules/mod2.js'
import * as mod5 from 'util/test/modules/mod1.js'
import * as mod6 from 'util/test/modules/mod2.js'
import * as mod7 from 'util/test/modules/mod1.js'
import * as mod8 from 'util/test/modules/mod2.js'
import * as mod9 from 'util/test/modules/mod1.js'
import * as mod10 from 'util/test/modules/mod2.js'

//const b = new Uint8Array(256)

/*
spin.assert(mod1.dump(b) === mod2.dump(b))
spin.assert(mod2.dump(b) === mod3.dump(b))
spin.assert(mod3.dump(b) === mod4.dump(b))
spin.assert(mod4.dump(b) === mod5.dump(b))
spin.assert(mod5.dump(b) === mod6.dump(b))
spin.assert(mod6.dump(b) === mod7.dump(b))
spin.assert(mod7.dump(b) === mod8.dump(b))
spin.assert(mod8.dump(b) === mod9.dump(b))
spin.assert(mod9.dump(b) === mod10.dump(b))
*/
/*
hyperfine --warmup 100 "./spin util/test/modules/test-mod.js"
  Time (mean ± σ):      15.6 ms ±   1.9 ms    [User: 11.4 ms, System: 4.7 ms]
  Range (min … max):    13.3 ms …  20.8 ms    149 runs
*/

//console.log(JSON.stringify(Array.from(spin.moduleCache.entries()), null, '  '))
//console.log(JSON.stringify(Array.from(spin.libCache.entries()), null, '  '))

const app = { libs: Array.from(spin.libCache.entries()), modules: Array.from(spin.moduleCache.entries()) }
//console.log(JSON.stringify(app).length)
console.log(JSON.stringify(app))