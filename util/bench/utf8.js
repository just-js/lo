if (!globalThis.TextEncoder) {
  const { Library } = await import('lib/ffi.js')
  const { memcpy } = new Library()
    .open()
    .bind({
      memcpy: {
        parameters: ['pointer', 'string', 'i32'],
        result: 'pointer'
      }
    })

  class TextEncoder {
    encodeInto (str, u8) {
      if (!u8.ptr) spin.ptr(u8)
      memcpy(u8.ptr, str, str.length)
    }
  }
  globalThis.TextEncoder = TextEncoder
}

function bench(count) {
  const start = Date.now();
  for (let i = 0; i < count; i++) writeString();
  const elapsed = Date.now() - start;
  const rate = Math.floor(count / (elapsed / 1000));
  console.log(`time ${elapsed} ms rate ${rate}`);
}

const encoder = new TextEncoder();
const data = (new Array(16384).fill(0)).map(v => '1').join('')
const out = new Uint8Array(data.length);
const writeString = () => encoder.encodeInto(data, out)

while (1) bench(2000000)