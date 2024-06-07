const api = {
  InitWindow: { parameters: ['i32', 'i32', 'string'], result: 'void' },
  SetTargetFPS: { parameters: ['i32'], result: 'void' },
  WindowShouldClose: { parameters: [], result: 'bool' },
  IsKeyPressed: { parameters: ['i32'], result: 'bool' },
  IsGestureDetected: { parameters: ['u32'], result: 'bool' },
  BeginDrawing: { parameters: [], result: 'void' },
  ClearBackground: {
    parameters: ['buffer'],
    casts: ['*(Color*)'],
    result: 'void',
  },
  DrawText: {
    parameters: ['string', 'i32', 'i32', 'i32', 'buffer'],
    casts: [, , , , '*(Color*)'],
    result: 'void',
  },
  DrawRectangle: {
    parameters: ['i32', 'i32', 'i32', 'i32', 'buffer'],
    casts: [, , , , '*(Color*)'],
    result: 'void',
  },
  EndDrawing: { parameters: [], result: 'void' },
  CloseWindow: { parameters: [], result: 'void' },
}

const name = 'raylib'

const constants = {}
const obj = ['deps/raylib/lib/libraylib.a']
const includes = ['deps/raylib/include/raylib.h']

export { name, api, constants, obj, includes }
