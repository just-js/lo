import { Library } from 'lib/ffi.js'
import { Timer } from 'lib/timer.js'
import { Loop } from 'lib/loop.js'

const { assert } = spin

const SDL_INIT_VIDEO = 0x20

const SDL_WINDOWPOS_UNDEFINED = 0x1FFF0000
const SDL_WINDOW_SHOWN = 4
const SDL_RENDERER_ACCELERATED = 2
const SDL_QUIT = 256

const SDL2 = (new Library()).open('./scratch/libSDL2.so').bind({
  init: {
    result: 'i32',
    parameters: ['u32'],
    name: 'SDL_Init'
  },
  createWindow: {
    parameters: ['string', 'i32', 'i32', 'i32', 'i32', 'u32'],
    pointers: ['const char*'],
    result: 'pointer',
    rpointer: 'SDLWindow*',
    name: 'SDL_CreateWindow'
  },
  createRenderer: {
    parameters: ['pointer', 'i32', 'u32'],
    pointers: ['SDL_Window*'],
    result: 'pointer',
    rpointer: 'SDL_Renderer*',
    name: 'SDL_CreateRenderer'
  },
  waitEvent: {
    parameters: ['u32array'],
    pointers: ['SDLEvent*'],
    result: 'i32',
    name: 'SDL_WaitEvent'
  },
  pollEvent: {
    parameters: ['u32array'],
    pointers: ['SDLEvent*'],
    result: 'i32',
    name: 'SDL_PollEvent'
  },
  setRenderDrawColor: {
    parameters: ['pointer', 'u8', 'u8', 'u8', 'u8'],
    pointers: ['SDL_Renderer*'],
    result: 'i32',
    name: 'SDL_SetRenderDrawColor'
  },
  renderClear: {
    parameters: ['pointer'],
    pointers: ['SDL_Renderer*'],
    result: 'i32',
    name: 'SDL_RenderClear'
  },
  renderFillRect: {
    parameters: ['pointer', 'buffer'],
    pointers: ['SDL_Renderer*', 'const SDL_Rect*'],
    result: 'i32',
    name: 'SDL_RenderFillRect'
  },
  renderPresent: {
    parameters: ['pointer'],
    pointers: ['SDL_Renderer*'],
    result: 'void',
    name: 'SDL_RenderPresent'
  },
  destroyRenderer: {
    parameters: ['pointer'],
    pointers: ['SDL_Renderer*'],
    result: 'void',
    name: 'SDL_DestroyRenderer'
  },
  destroyWindow: {
    parameters: ['pointer'],
    pointers: ['SDL_Window*'],
    result: 'void',
    name: 'SDL_DestroyWindow'
  },
  quit: {
    parameters: [],
    result: 'void',
    name: 'SDL_Quit'
  }
})

assert(SDL2.init(SDL_INIT_VIDEO) === 0)
const hWnd = SDL2.createWindow('Testing...', 100, 100, 800, 600, SDL_WINDOW_SHOWN)
assert(hWnd)
const hRend = SDL2.createRenderer(hWnd, -1, SDL_RENDERER_ACCELERATED)
assert(hRend)
const rect = new Int32Array(4)
rect[0] = 10 // x
rect[1] = 10 // y
rect[2] = 780 // width
rect[3] = 580 // height
const rectu8 = new Uint8Array(rect.buffer)

const eventLoop = new Loop()

const timer = new Timer(eventLoop, 1000, () => {
  console.log('hello')
})

const event = new Uint32Array(14)

let ticks = 0

while (1) {
  spin.runMicroTasks()
  if (SDL2.pollEvent(event) === 1) {
    const [type] = event
    if (type === SDL_QUIT) break
    console.log(event)
    SDL2.setRenderDrawColor(hRend, 0xff, 0xff, 0xff, 0xff)
    SDL2.renderClear(hRend)
    SDL2.setRenderDrawColor(hRend, 0xff, 0x00, 0x00, 0xff)
    SDL2.renderFillRect(hRend, rectu8)
    SDL2.renderPresent(hRend)  
  }
  eventLoop.poll(0)
  ticks++
}

timer.close()
SDL2.destroyRenderer(hRend)
SDL2.destroyWindow(hWnd)
SDL2.quit()
