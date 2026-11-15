// statically imports mid.js, whose own '../lib.js' import then goes through the
// instantiate callback: PLAN task 79's two-hop chain
import { doubled } from 'test/modules/relative/a/mid.js'
export { doubled }
