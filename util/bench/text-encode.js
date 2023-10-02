import { run } from 'lib/bench.js'

let u = new Uint8Array(2048);
let te = new TextEncoder();

//const str = 'hello world'
//const str = 'h'.repeat(11)
//run('TextEncoder.encodeInto with subarray(10)', () => te.encodeInto('hello world', u.subarray(10)), 40000000, 10)
run('TextEncoder.encodeInto', () => te.encodeInto('h'.repeat(11), u), 15000000, 10)
