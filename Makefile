CC=g++
FLAGS=${CFLAGS}
LFLAG=${LFLAGS}
#LFLAG=${LFLAGS} -static-libgcc -static-libstdc++ 
# v8 monolithic lib release (from just-js)
RELEASE=0.1.15
# binary name
TARGET=spin
# name of runtime object on globalThis in JS
GLOBALOBJ="spin"
# we have to link dl as v8 requires it
LIB=
# directory to look for c++ modules
MODULE_DIR=module
# passed to module makefile so they can acces headers
SPIN_HOME=$(shell pwd)
# list of c++ library archive (.a) files to link into runtime
#MODULES=module/load/load.a module/fs/fs.a module/ffi/ffi.a module/tcc/tcc.a
#MODULES=module/load/load.a module/fs/fs.a module/fast/fast.a module/system/system.a
MODULES=module/load/load.a module/fs/fs.a module/system/system.a module/fast/fast.a module/spin/spin.a module/thread/thread.a module/net/net.a module/epoll/epoll.a module/pico/pico.a module/encode/encode.a
# list of JS modules to link into runtime
#LIBS=lib/ansi.js lib/bench.js lib/binary.js lib/ffi.js lib/gen.js lib/packet.js lib/path.js lib/stringify.js
#LIBS=lib/gen.js lib/fast.js lib/asm.js lib/system.js lib/bench.js
LIBS=lib/gen.js lib/system.js lib/fast.js lib/asm.js lib/bench.js lib/net.js lib/loop.js lib/pico.js lib/timer.js lib/binary.js lib/acorn.js lib/path.js lib/thread.js lib/fs.js lib/websocket.js
# list of arbitrary assets to link into runtime
ASSETS=
# when initializing a module, the path to the api defintion
MODULE_DEF=
# directory to look for native api bindings
BINDINGS_DIR=bindings
# directory where scc binary is located
SCC_DIR=/home/andrew/go/bin
# flags for v8 compilation
#V8_FLAGS="-DV8_DEPRECATION_WARNINGS=1 -DV8_IMMINENT_DEPRECATION_WARNINGS=1 -DV8_HAS_ATTRIBUTE_VISIBILITY=0"
V8_FLAGS=
DEPS=deps/v8/libv8_monolith.a
WARNFLAGS=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter
#WARNFLAGS=

.PHONY: help clean

help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_\.-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deps: ## download v8 headers and monolithic lib for compiling and linking
	mkdir -p deps
	curl -L -o v8lib-$(RELEASE).tar.gz https://raw.githubusercontent.com/just-js/libv8/$(RELEASE)/v8.tar.gz
	tar -zxvf v8lib-$(RELEASE).tar.gz
	rm -f v8lib-$(RELEASE).tar.gz

builtins.o: main.js builtins.S ${LIBS} ## link the assets into an object file
	gcc -flto builtins.S -c -o builtins.o

builtins.S: ${LIBS} ${ASSETS} ## generate the assembly file for linking assets into runtime
#ifeq (,$(wildcard ./${TARGET}))
#	./${TARGET} gen --link ${LIBS} ${ASSETS} > builtins.new.S
#	mv builtins.new.S builtins.S
#endif

main.h: ${LIBS} ${MODULES} ${ASSETS} ## generate the main.h to initialize libs and modules
#ifeq (,$(wildcard ./${TARGET}))
#	./${TARGET} gen --header ${LIBS} ${MODULES} ${ASSETS} > main.new.h
#	mv main.new.h main.h
#endif

main.o: main.h ## compile the main app
	$(CC) -fno-rtti -flto -g -O3 -c ${FLAGS} ${V8_FLAGS} -DGLOBALOBJ='${GLOBALOBJ}' -DVERSION='"${RELEASE}"' -std=c++17 -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I./deps/v8/include -I./deps/v8 -msse4 -march=native -mtune=native ${WARNFLAGS} main.cc

${TARGET}.o: ${TARGET}.h ${TARGET}.cc ## compile the main library
	$(CC) -fno-rtti -flto -g -O3 -c ${FLAGS} ${V8_FLAGS} -DGLOBALOBJ='${GLOBALOBJ}' -DVERSION='"${RELEASE}"' -std=c++17 -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I./deps/v8/include -I./deps/v8 -msse4 -march=native -mtune=native ${WARNFLAGS} ${TARGET}.cc

${TARGET}: ${TARGET}.o main.o builtins.o ## link the runtime
	$(CC) -fno-rtti -flto -g -O3 ${V8_FLAGS} -rdynamic -m64 -Wl,--start-group main.o ${TARGET}.o builtins.o ${DEPS} ${MODULES} -Wl,--end-group ${LFLAG} ${LIB} -o ${TARGET}
	objcopy --only-keep-debug ${TARGET} ${TARGET}.debug
	strip --strip-debug --strip-unneeded ${TARGET}
	objcopy --add-gnu-debuglink=${TARGET}.debug ${TARGET}

${TARGET}-debug: ${TARGET}.o main.o builtins.o ## link the runtime
	$(CC) -flto -g3 -O3 ${V8_FLAGS} -rdynamic -m64 -Wl,--start-group main.o ${TARGET}.o builtins.o ${DEPS} ${MODULES} -Wl,--end-group ${LFLAG} ${LIB} -o ${TARGET}

${TARGET}.so: ${TARGET}.o main.o builtins.o ## link the runtime
	$(CC) -flto -g -O3 ${V8_FLAGS} -rdynamic -shared -m64 -Wl,--start-group ${TARGET}.o builtins.o ${DEPS} ${MODULES} -Wl,--end-group ${LFLAG} ${LIB} -o ${TARGET}.so
	objcopy --only-keep-debug ${TARGET}.so ${TARGET}.so.debug
	strip --strip-debug --strip-unneeded ${TARGET}.so
	objcopy --add-gnu-debuglink=${TARGET}.so.debug ${TARGET}.so

${TARGET}-static: ${TARGET}.o main.o builtins.o ## link the runtime
	$(CC) -flto -g -O3 ${V8_FLAGS} -static -m64 -Wl,--start-group main.o ${TARGET}.o builtins.o ${DEPS} ${MODULES} -Wl,--end-group ${LFLAG} ${LIB} -o ${TARGET}
	objcopy --only-keep-debug ${TARGET} ${TARGET}.debug
	strip --strip-debug --strip-unneeded ${TARGET}
	objcopy --add-gnu-debuglink=${TARGET}.debug ${TARGET}

all:
	${MAKE} clean
	${MAKE} ${TARGET}

${MODULE_DIR}/${MODULE}: ## initialize a new module from an api definition
	mkdir -p ${MODULE_DIR}/${MODULE}

stdlibs:
	${MAKE} MODULE=load library
	${MAKE} MODULE=fs library
	${MAKE} MODULE=system library
	${MAKE} MODULE=fast library
	${MAKE} MODULE=spin library
	${MAKE} MODULE=thread library
	${MAKE} MODULE=net library
	${MAKE} MODULE=epoll library
	${MAKE} MODULE=pico library
	${MAKE} MODULE=encode library

libs:
	${MAKE} MODULE=adaurl gen library
#	${MAKE} MODULE=bestline gen library
	${MAKE} MODULE=dynasm gen library
	${MAKE} MODULE=encode gen library
	${MAKE} MODULE=epoll gen library
	${MAKE} MODULE=fast gen library
	${MAKE} MODULE=ffi gen library
	${MAKE} MODULE=fs gen library
	${MAKE} MODULE=libssl gen library
	${MAKE} MODULE=load gen library
#	${MAKE} MODULE=lz4 gen library
	${MAKE} MODULE=net gen library
	${MAKE} MODULE=pico gen library
	${MAKE} MODULE=rocksdb gen library
	${MAKE} MODULE=rsync gen library
	${MAKE} MODULE=rustls gen library
	${MAKE} MODULE=seccomp gen library
	${MAKE} MODULE=snapshot gen library
	${MAKE} MODULE=spin gen library
	${MAKE} MODULE=sqlite gen library
	${MAKE} MODULE=system gen library
	${MAKE} MODULE=tcc gen library
	${MAKE} MODULE=thread gen library
	${MAKE} MODULE=wireguard gen library

gen: ${TARGET} ${MODULE_DIR}/${MODULE} ## generate source and Makefile from definitions for a library
	mkdir -p ${MODULE_DIR}/${MODULE}
	./${TARGET} gen --make ${BINDINGS_DIR}/${MODULE}/${MODULE}.js > ${MODULE_DIR}/${MODULE}/Makefile
	./${TARGET} gen ${BINDINGS_DIR}/${MODULE}/${MODULE}.js > ${MODULE_DIR}/${MODULE}/${MODULE}.cc

scc: ## generate report on lines of code, number of files, code complexity
	${SCC_DIR}/scc --exclude-dir="util,deps,bench,test,.devcontainer,.git,.vscode,scratch,example,doc,docker,main.h,module/,test.js" --include-ext="cc,c,h,js,mk" --gen --wide --by-file ./ > scc.txt

library: ## build a spin shared library
	CFLAGS="$(FLAGS)" LFLAGS="${LFLAG}" SPIN_HOME="$(SPIN_HOME)" $(MAKE) -C ${MODULE_DIR}/${MODULE}/ clean library

check:
	cppcheck --std=c++17 --language=c++ -j2 --enable=style ./*.cc
	cppcheck --std=c++17 --language=c++ -j2 --enable=style ./*.h
	cppcheck --std=c++17 --language=c++ -j2 --enable=style ./module/**/*.cc
	cppcheck --std=c++17 --language=c++ -j2 --enable=style ./module/**/*.h

boot:
	rm -f builtins.S
	rm -f main.h
	rm -f *.o

clean: ## tidy up
	rm -f *.o
	rm -f ${TARGET}
	rm -f ${TARGET}.so
	rm -f *.debug

cleanall: ## remove target and build deps
	rm -fr deps
	$(MAKE) clean
	rm -f ${TARGET}
	rm -f ${TARGET}.debug

.DEFAULT_GOAL := help
