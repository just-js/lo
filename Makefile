# defaults to a plain glibc build - pass MUSL=1 explicitly for a musl
# build (this sandbox's own alpine-toolchain, or any other). No
# auto-detection: the standard musl-loader-file check is unreliable
# whenever musl-tools or similar is installed alongside glibc as a
# secondary/cross toolchain, which is a normal thing to have on a
# regular glibc host. MUSL_SYSROOT only matters when MUSL=1; override it
# if your musl toolchain lives somewhere other than this sandbox's own.
# See LO-MUSL.md.
MUSL ?= 0
MUSL_SYSROOT ?= /root/demo/alpine-toolchain/root

CC=clang
CXX=clang++
LINK=clang++
LARGS=-rdynamic -pthread
CCARGS=-fPIC -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden
CARGS=-fPIC -c -fno-omit-frame-pointer -fvisibility=hidden
WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter -Wno-error=unknown-warning-option
ifeq ($(MUSL),1)
	LARGS+=--sysroot=$(MUSL_SYSROOT)
	CCARGS+=--sysroot=$(MUSL_SYSROOT) -D_LARGEFILE64_SOURCE
	CARGS+=--sysroot=$(MUSL_SYSROOT) -D_LARGEFILE64_SOURCE
endif
OPT=-O3
VERSION=0.0.33-pre
V8_VERSION=15.2
RUNTIME=lo
LO_HOME=$(shell pwd)
BINDINGS=core.o inflate.a curl.o system.o
ARCH=x64
os=linux
TARGET=${RUNTIME}
LIBS=-ldl -lcurl -lssl -lz
# V8_COMPRESS_POINTERS must match repos/v8's own v8_enable_pointer_compression
# (all 6 args.*.gn platform files) or V8::Initialize() hard-aborts with
# "Embedder-vs-V8 build configuration mismatch" (real CI failure, run
# 32610257944) - api.cc's build_config compatibility check compares this
# embedder-side define against what libv8_monolith.a was actually built with.
V8_FLAGS=-DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS -DV8_COMPRESS_POINTERS
LIB_DIRS=

ifeq ($(OS),Windows_NT)
	os=win
else
	UNAME_S := $(shell uname -s)
	ifeq ($(UNAME_S),Linux)
		os=linux
		LARGS+=-s -static-libgcc -fuse-ld=lld
		BINDINGS+=epoll.o
ifeq ($(MUSL),1)
		BINDINGS+=musl-glibc-compat.o
endif
	  OPT+=-march=native -mtune=native
  else ifeq ($(UNAME_S),Darwin)
		os=mac
		BINDINGS+=mach.o kevents.o
		LARGS+=-s -w -framework CoreFoundation
		LIB_DIRS+=-L"/opt/homebrew/lib"
		ifeq ($(ARCH),arm64)
			LARGS+=-arch arm64
			CARGS+=-arch arm64
			CCARGS+=-arch arm64
      OPT+=-march=native -mtune=native
    else
      CARGS+=-arch x86_64
      CCARGS+=-arch x86_64
      LARGS+=-arch x86_64
		endif
	endif
endif

.PHONY: help clean cleanall check install builtins.h check-build reset

# clean's own recipe (rm -f *.o/*.a/${RUNTIME}) has no dependency edge to
# anything else in this file, so under -j a combined invocation like
# `make -j4 clean lo` can run clean's deletes concurrently with lo's own
# build steps - a real race (a compile job's freshly-written .o can get
# rm -f'd out from under it, or deleted after make already considers that
# target built this run, breaking the final link). Force this one
# invocation serial whenever clean is one of the requested goals; normal
# `make -j4 lo` (no clean) is unaffected and stays fully parallel.
ifneq ($(filter clean,$(MAKECMDGOALS)),)
.NOTPARALLEL:
endif

help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9\/_\.-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

v8/.stamp:
	mkdir -p v8
	touch v8/.stamp

v8/include/.stamp: | v8/.stamp ## download the v8 source code for debugging
	curl -L -O https://github.com/just-js/v8/releases/download/${V8_VERSION}/include.tar.gz
	tar -xvf include.tar.gz
	rm -rf v8/include
	mv include v8/
	touch v8/include/.stamp
ifneq ($(os),win)
	rm -f include.tar.gz
endif

v8/src/.stamp: | v8/.stamp ## download the v8 source code for debugging
	curl -L -O https://github.com/just-js/v8/releases/download/${V8_VERSION}/src.tar.gz
	tar -xvf src.tar.gz
	rm -rf v8/src
	mv src v8/
	touch v8/src/.stamp
ifneq ($(os),win)
	rm -f src.tar.gz
endif

v8/libv8_monolith.a: | v8/include/.stamp  ## download the v8 static libary for linux/macos
	curl -C - -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.a.gz
	gzip -df v8/libv8_monolith.a.gz
	touch v8/libv8_monolith.a
	rm -f v8/libv8_monolith.a.gz

v8/v8_monolith.lib: | v8/include/.stamp ## download the v8 static library for windows
	curl -C - -L -o v8/v8_monolith.lib.zip https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.zip
	unzip -o v8/v8_monolith.lib.zip
	touch v8/v8_monolith.lib

main.o: | v8/include/.stamp ## compile the main.cc object file
	$(CXX) ${CCARGS} ${OPT} -DRUNTIME='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I./v8 -I./v8/include ${WARN} ${V8_FLAGS} main.cc

builtins.o: ## link all source files and assets into an object file
ifeq (${os},linux)
	$(CC) ${CARGS} builtins_linux.S -o builtins.o
else
	$(CC) ${CARGS} builtins.S -o builtins.o
endif

${RUNTIME}.o: | v8/include/.stamp ## compile runtime into an object file
	$(CXX) ${CCARGS} ${OPT} -DRUNTIME='"${RUNTIME}"' -DVERSION='"${VERSION}"' ${V8_FLAGS} -I./v8 -I./v8/include ${WARN} ${RUNTIME}.cc

${RUNTIME}: v8/libv8_monolith.a main.js ${BINDINGS} builtins.o main.o ${RUNTIME}.o ## link the runtime for linux/macos
	@echo building ${RUNTIME} for ${os} on ${ARCH}
	$(LINK) $(LARGS) ${OPT} main.o ${RUNTIME}.o builtins.o ${BINDINGS} ${LIBS} -o ${TARGET} -L"./v8" -lv8_monolith ${LIB_DIRS}

${RUNTIME}.exe: v8 v8/v8_monolith.lib main.js ## link the runtime for windows
	cl /EHsc /std:c++20 /DRUNTIME='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I. /I./v8 /I./v8/include /c ${V8_FLAGS} main.cc
#	cl /EHsc /std:c++20 /DRUNTIME='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I./v8 /I./v8/include /c main.cc
	cl /EHsc /std:c++20 /DRUNTIME='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I. /I./v8 /I./v8/include /c ${V8_FLAGS} ${RUNTIME}.cc
#	cl /EHsc /std:c++20 /DRUNTIME='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I./v8 /I./v8/include /c ${RUNTIME}.cc
	cl v8/v8_monolith.lib ${RUNTIME}.obj main.obj core.obj winmm.lib dbghelp.lib advapi32.lib /link /out:${TARGET}.exe
#	cl v8/v8_monolith.lib ${RUNTIME}.obj main.obj winmm.lib dbghelp.lib advapi32.lib /link /out:${TARGET}.exe

#builtins.h: main.js
#	./lo .\gen.js main.js > builtins.h

mach.o: lib/mach/mach.cc | v8/include/.stamp ## build the mach binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include $(WARN) ${V8_FLAGS} -o mach.o lib/mach/mach.cc

core.o: lib/core/core.cc | v8/include/.stamp ## build the core binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include $(WARN) ${V8_FLAGS} -o core.o lib/core/core.cc

epoll.o: lib/epoll/epoll.cc | v8/include/.stamp ## build the epoll binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include $(WARN) ${V8_FLAGS} -o epoll.o lib/epoll/epoll.cc

system.o: lib/system/system.cc | v8/include/.stamp ## build the system binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include $(WARN) ${V8_FLAGS} -o system.o lib/system/system.cc

musl-glibc-compat.o: musl-glibc-compat.c ## glibc symbol shims v8/libv8_monolith.a needs on musl
	$(CC) $(CARGS) -U_LARGEFILE64_SOURCE $(OPT) -o musl-glibc-compat.o musl-glibc-compat.c

kevents.o: lib/kevents/kevents.cc | v8/include/.stamp ## build the kqueue binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include $(WARN) ${V8_FLAGS} -o kevents.o lib/kevents/kevents.cc

core.obj: core.cc v8 
	cl /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c core.cc

curl.o: lib/curl/curl.cc | v8/include/.stamp ## build the curl binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include $(WARN) ${V8_FLAGS} -o curl.o lib/curl/curl.cc

lib/inflate/em_inflate.h:
	curl -L -o lib/inflate/em_inflate.h https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.h

lib/inflate/em_inflate.c:
	curl -L -o lib/inflate/em_inflate.c https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.c

lib/inflate/em_inflate.o: lib/inflate/em_inflate.h lib/inflate/em_inflate.c ## build the em_inflate object
	$(CC) -fPIC $(CARGS) $(OPT) -I. -I./v8 -I./v8/include -Ilib/inflate -o lib/inflate/em_inflate.o lib/inflate/em_inflate.c

inflate.a: lib/inflate/em_inflate.o ## build the inflate binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include -Ilib/inflate $(WARN) ${V8_FLAGS} -o inflate.o lib/inflate/inflate.cc
	ar crsT inflate.a inflate.o lib/inflate/em_inflate.o

lo.node: lo
	cd bindings && npm install && cp build/Release/lo.node ../

check: ## run the runtime sanity tests
	./${RUNTIME} test/runtime.js
	./${RUNTIME} test/dump.js
	./${RUNTIME} test/fs.js
	./${RUNTIME} test/dump-binding.js core
	./${RUNTIME} test/dump-binding.js inflate
	./${RUNTIME} test/dump-binding.js curl

check-build: ## test building works
	LO_HOME=${LO_HOME} ./${RUNTIME} test/build.js

docs:
	rm -fr docs
	curl -L -o docs.tar.gz https://github.com/just-js/docs/archive/$(VERSION).tar.gz
	tar -xvf docs.tar.gz
	mv docs-$(VERSION) docs
	rm -f docs.tar.gz

install:
	mkdir -p ${HOME}/.lo/bin
	cp lo ${HOME}/.lo/bin/

clean:
ifeq ($(os),win)
	@del /q *.obj > NUL 2>&1
	@del /q builtins.h > NUL 2>&1
	@del /q ${RUNTIME}.exe > NUL 2>&1
	@del /q ${RUNTIME}.exp > NUL 2>&1
	@del /q ${RUNTIME}.lib > NUL 2>&1
else
	rm -f *.o
	rm -f *.a
	rm -f lib/**/*.a
	rm -f lib/**/*.o
	rm -f lib/**/*.so
	rm -f ${RUNTIME}
endif

reset:
	git checkout builtins_linux.S builtins.S main.h

cleanall:
	$(MAKE) clean
ifeq ($(os),win)
	@rmdir /s /q v8 > NUL 2>&1
else
	rm -fr v8
endif
