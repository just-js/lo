CC=clang
CXX=clang++
LINK=clang++
LARGS=-rdynamic -pthread
CCARGS=-fPIC -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden
CARGS=-fPIC -c -fno-omit-frame-pointer -fvisibility=hidden
WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter -Wno-error=unknown-warning-option
OPT=-O3
VERSION=0.0.23-pre
V8_VERSION=14.3
RUNTIME=lo
LO_HOME=$(shell pwd)
BINDINGS=core.o inflate.a curl.o
ARCH=x64
os=linux
TARGET=${RUNTIME}
LIBS=-ldl -lcurl -lssl -lz
V8_FLAGS=-DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS
LIB_DIRS=

ifeq ($(OS),Windows_NT)
	os=win
else
	UNAME_S := $(shell uname -s)
	ifeq ($(UNAME_S),Linux)
		os=linux
		LARGS+=-s -static-libgcc -fuse-ld=lld
	  OPT+=-march=native -mtune=native
  else ifeq ($(UNAME_S),Darwin)
		os=mac
		BINDINGS+=mach.o
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

.PHONY: help clean cleanall check install builtins.h check-build

help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9\/_\.-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

v8:
	mkdir -p v8

v8/include: v8 ## download the v8 source code for debugging
	curl -L -O https://github.com/just-js/v8/releases/download/${V8_VERSION}/include.tar.gz
	tar -xvf include.tar.gz
	mv include v8/
ifneq ($(os),win)
	rm -f include.tar.gz
endif

v8/src: ## download the v8 source code for debugging
	curl -L -O https://github.com/just-js/v8/releases/download/${V8_VERSION}/src.tar.gz
	tar -xvf src.tar.gz
	mv src v8/
ifneq ($(os),win)
	rm -f src.tar.gz
endif

v8/libv8_monolith.a: v8/include ## download the v8 static libary for linux/macos
	curl -C - -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.a.gz
	gzip -d v8/libv8_monolith.a.gz
	rm -f v8/libv8_monolith.a.gz

v8/v8_monolith.lib: ## download the v8 static library for windows
	curl -C - -L -o v8/v8_monolith.lib.zip https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.zip
	unzip v8/v8_monolith.lib.zip

main.o: ## compile the main.cc object file
	$(CXX) ${CCARGS} ${OPT} -DRUNTIME='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I./v8 -I./v8/include ${WARN} ${V8_FLAGS} main.cc

builtins.o: ## link all source files and assets into an object file
ifeq (${os},linux)
	$(CC) ${CARGS} builtins_linux.S -o builtins.o
else
	$(CC) ${CARGS} builtins.S -o builtins.o
endif

${RUNTIME}.o: ## compile runtime into an object file 
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

mach.o: lib/mach/mach.cc v8 ## build the mach binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include $(WARN) ${V8_FLAGS} -o mach.o lib/mach/mach.cc

core.o: lib/core/core.cc v8 ## build the core binding
	$(CXX) -fPIC $(CCARGS) $(OPT) -I. -I./v8 -I./v8/include $(WARN) ${V8_FLAGS} -o core.o lib/core/core.cc

core.obj: core.cc v8 
	cl /EHsc /std:c++20 /I. /I./v8 /I./v8/include /c core.cc

curl.o: lib/curl/curl.cc v8 ## build the curl binding
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

check: ## run the runtime sanity tests
	./${RUNTIME} test/runtime.js
	./${RUNTIME} test/dump.js
	./${RUNTIME} test/fs.js
	./${RUNTIME} test/dump-binding.js core
	./${RUNTIME} test/dump-binding.js inflate
	./${RUNTIME} test/dump-binding.js curl

check-build: ## test building works
	./${RUNTIME} test/build.js

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

cleanall:
	$(MAKE) clean
ifeq ($(os),win)
	@rmdir /s /q v8 > NUL 2>&1
else
	rm -fr v8
endif
