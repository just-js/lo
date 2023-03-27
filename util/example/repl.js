import { Library } from 'lib/ffi.js'
import { stringify } from 'lib/stringify.js'
import { api } from 'bindings/bestline/bestline.js'

const { AG, AD, AR } = spin.colors
const { utf8Decode } = spin

const encoder = new TextEncoder()

const bestline = (new Library()).open('./scratch/bestline.so').bind(api)
bestline.load('.spin_history')
const prompt = encoder.encode(`${AG}>${AD} \0`)

bestline.cls(1)
let line
while (line = bestline.bestline(prompt)) {
  try {
    const command = utf8Decode(line, -1)
    if (!command) {
      continue
    } 
    if (command === '.exit') break
    if (command === '.cls') {
      bestline.cls(1)
      continue
    }
    const result = function (str) {
      return eval(str)
    }.call(this, command)
    if (result) console.log(stringify(result))
  } catch (err) {
    console.error(`${AR}${err.message}${AD}\n${err.stack}`)
  }
  bestline.add(line)
}

bestline.save('.spin_history')
