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
- [ ] **todo**:  language server
- [ ] **todo**:  snake case
- [ ] **todo**:  can we unload bindings and modules? have a look into this
- [ ] **bug**:   if i embed the binding definition and change it then the lib won't rebuild as it uses embedded one
- [ ] **todo**:  change binding defs so we can have multiple entries with same name but with different options for arch and platform
- [ ] **todo**:  pass a flag to gen to tell it what os/arch we want to generate for
- [ ] **bug**:   when rebuilding after changing bindings defs, they don't get re-generated as the ones on disk are not re-loaded.
- [ ] **todo**:  clean up lib/gen.js. it's a real mess
- [ ] **todo**:  have an embed cache separate from lib and require caches so we always load them from disk. hmmm... we need a nice way to handle this
- [ ] **todo**:  module resolution is really broken
- [ ] **todo**:  setTimeout, clearTimeout, setInterval, clearInterval
- [ ] **todo**:  performance.now()
- [ ] **todo**:  in assert, strip the assert line from the stack trace on the error
- [ ] **question**: should we have something like __dirname on each module?
- [ ] **todo**:  make lib/proc exec() async and used pidfd_open to monitor process on event loop
- [ ] **todo**:  freeze core apis/intrinsics
- [ ] **question**: how do we handle compiling dependencies of bindings cross platform if we don't depend on make?
                    we could just write the build script as js?
- [ ] **question**: how do we align structs in memory?
- [ ] **todo**:  ability to chain cli args together
- [ ] **todo**:  repl - doesn't really need async for now - ```lo repl```
- [ ] **todo**:  rename lo.library and lo.libraries to lo.binding and lo.bindings
- [ ] **todo**:  proc.js - mem() doesn't work on macos (no proc fs)
- [ ] **bug**:   if i run ```lo main.js``` it goes into a loop as it tries to recursively load the builtin main.js

## features

- [ ] **commands**: ability to host command scripts so i can run ```lo cmd blah``` and it will run blah.js from cmd direction in current dir or $HOME/.lo/cmd
- [ ] **fetch**: a robust and fast fetch implementation
- [ ] **serve**: a robust and fast http serve implementation with Request and Response
- [ ] **ffi**: a robust and fast ffi implementation
- [ ] **spawn**: a robust and fast process spawning and control implementation
- [ ] **resources**: a solution for tracking handles, pointers and file descriptors
- [ ] **hot loading**: look at ability to easily swap code out on the fly
- [ ] **v8 api**: create a simple c api around v8 (like rusty_v8) so we can use it in bindings and compile/link bindings with tcc (maybe - i think so - the bindings libraries can be plain c)
- [ ] **tracing**: a system for hooking into traces events for logging, metrics etc.
- [ ] **todo**: use new format for bindings to allow same method for multiple platforms
                get platform filtering working with bindings generation

## modules

- [ ] **Worker**: a robust and fast Web Worker implementation
- [ ] **WebSocket**: a robust and fast websocket implementation - client and server
- [ ] **sqlite**: a robust and fast sqlite implementation
- [ ] **thread**: thread library


