import { bind } from 'lib/fast.js'
import { system } from 'lib/system.js'

const { assert, dlopen, dlsym, wrap } = spin

function rect (x, y, w, h) {
  return new Uint8Array((new Int32Array([x, y, w, h])).buffer)  
}

const SDL_INIT_VIDEO = 0x20
const SDL_WINDOW_SHOWN = 4
const SDL_RENDERER_ACCELERATED = 2
const SDL_QUIT = 256
const u32 = new Uint32Array(2)
const event = new Uint32Array(14)
const handle = assert(dlopen('libSDL2.so', 1))
const create_window = wrap(u32, bind(assert(dlsym(handle, 'SDL_CreateWindow')), 
  'pointer', ['string', 'i32', 'i32', 'i32', 'i32', 'u32']), 6)
const init = bind(assert(dlsym(handle, 'SDL_Init')), 'i32', ['u32'])
const create_renderer = wrap(u32, bind(assert(dlsym(handle, 
  'SDL_CreateRenderer')), 'pointer', ['pointer', 'i32', 'u32']), 3)
const poll_event = bind(assert(dlsym(handle, 'SDL_PollEvent')), 'i32', 
  ['u32array'])
const render_draw_color = bind(assert(dlsym(handle, 'SDL_SetRenderDrawColor')), 
  'i32', ['pointer', 'u8', 'u8', 'u8', 'u8'])
const render_clear = bind(assert(dlsym(handle, 'SDL_RenderClear')), 'i32', 
  ['pointer'])
const render_fill_rect = bind(assert(dlsym(handle, 'SDL_RenderFillRect')), 'i32', 
  ['pointer', 'buffer'])
const render_present = bind(assert(dlsym(handle, 'SDL_RenderPresent')), 'void', 
  ['pointer'])
assert(init(SDL_INIT_VIDEO) === 0)
const hWnd = assert(create_window('Testing...', 100, 100, 800, 600, 
  SDL_WINDOW_SHOWN))
const hRend = assert(create_renderer(hWnd, -1, SDL_RENDERER_ACCELERATED))
let initialised = false

while (1) {
  if (poll_event(event) === 1) {
    const [type] = event
    if (type === SDL_QUIT) break
    if (!initialised) {
      render_draw_color(hRend, 0xc0, 0xc0, 0xc0, 0xff)
      render_clear(hRend)
      render_draw_color(hRend, 0x44, 0x00, 0x00, 0xff)
      render_fill_rect(hRend, rect(10, 10, 780, 580))
      render_draw_color(hRend, 0x00, 0x44, 0x00, 0xff)
      render_fill_rect(hRend, rect(30, 30, 740, 540))
      render_draw_color(hRend, 0x00, 0x00, 0x44, 0xff)
      render_fill_rect(hRend, rect(50, 50, 700, 500))
      render_present(hRend)
      initialised = true
    }
    continue
  }
  system.usleep(16000)
}
