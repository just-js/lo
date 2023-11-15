## issues/tasks

- [x] **todo**:  fix clock_gettime/hrtime for macos
- [x] **todo**:  change namespace from spin to lo
- [x] **todo**:  get arm build working in github actions
- [x] **todo**:  fix assembly [issue](https://stackoverflow.com/questions/1034852/adding-leading-underscores-to-assembly-symbols-with-gcc-on-win32) - extra underscore on macos/windows
- [x] **todo**:  get windows build working
- [ ] **todo**:  add core module
- [ ] **todo**:  add lib/gen.js and other parts necessary to generate bindings
- [ ] **todo**:  add ffi
- [ ] **todo**:  get ffi working on arm64
- [ ] **issue**: clang does not work on raspberry pi linux
- [ ] **todo**:  a cleaner way to expose module resolution to JS
- [ ] **todo**:  use [this](https://github.com/marketplace/actions/run-on-architecture) to run tests on arm
- [ ] **todo**:  v8 inspector protocol support for debugging in vscode
- [ ] **todo**:  types and dx configurations for IDEs - autogenerate as much as possible
- [ ] **todo**:  fix hrtime() on windows
- [ ] **todo**:  get binary includes working for windows
- [ ] **todo**:  add method in github actions to test arm64 builds in a vm/emulator
- [ ] **todo**:  ffi support for arm64 on macos and linux and for x64 on windows
- [ ] **todo**:  ffi support for floats, structs and callbacks
- [ ] **todo**:  snapshot support - expose api to JS if possible
- [ ] **bug**:   static link on linux/arm64 is broken: ```mold -run make LARGS="-static" ARCH=arm64 C="ccache gcc" CC="ccache g++" clean lo```
- [ ] **todo**:  support android, libcosmo and risc-v. all 64 bit only.
- [ ] **todo**:  run release workflow on release created event and add changelog automatically
- [ ] **todo**:  add v8 LICENSE file from build
- [ ] **todo**:  path translation in core for lib/gen.js and modules
- [ ] **todo**:  tests for all build options
- [ ] **todo**:  script for bumping version number
- [ ] **todo**:  consolidate method for generating builtins on win/unix currently takes 11.4 ms for win and 8.1ms for unix for link the windows method is crazy slow the more files you have to do
- [ ] **todo**:  set something up to record build sizes and metrics/benches so we can track over time
- [ ] **todo**:  commands - install, uninstall, update
- [ ] **todo**:  change to using lib for bindings and libs
- [ ] **todo**:  overriding and hooking of module resolution

## features

- [ ] **fetch**: a robust and fast fetch implementation
- [ ] **WebSocket**: a robust and fast websocket implementation - client and server
- [ ] **serve**: a robust and fast http serve implementation with Request and Response
- [ ] **ffi**: a robust and fast ffi implementation
- [ ] **spawn**: a robust and fast process spawning and control implementation
- [ ] **Worker**: a robust and fast Web Worker implementation

## modules

- [ ] **sqlite**: a robust and fast sqlite implementation
- [ ] **thread**: thread library


