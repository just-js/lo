import { Library } from 'lib/ffi.js'
import { stringify } from 'lib/stringify.js'
import { colors } from 'lib/ansi.js'
import { api } from 'bindings/bestline/bestline.js'

const { AG, AD, AR } = colors
const { cstr, ptr, utf8Encode, utf8Decode } = spin

const bestline = (new Library('./scratch/bestline.so')).open().bind(api)
const historyFilename = cstr('.spin_history')
bestline.load(historyFilename.ptr)
const prompt = ptr(utf8Encode(`${AG}>${AD} `))

bestline.cls(1)
let line = bestline.bestline(prompt.ptr)
while (line) {
  try {
    const command = utf8Decode(line, -1)
    if (!command) {
      line = bestline.bestline(prompt.ptr)
      continue
    } 
    if (command === '.exit') break
    if (command === '.cls') {
      bestline.cls(1)
      line = bestline.bestline(prompt.ptr)
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
  line = bestline.bestline(prompt.ptr)
}

bestline.save(historyFilename.ptr)
