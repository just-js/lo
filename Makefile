C=clang
CC=clang++
LARGS=-"rdynamic"
CCARGS=-std=c++17 -c
CARGS=-c
WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter
OPT=-O3
VERSION=0.0.4-pre
V8_VERSION=12.0
RUNTIME=lo
LO_HOME=$(shell pwd)
BINDINGS=lib/core/core.a
ARCH=x64
os=linux
TARGET=${RUNTIME}

ifeq ($(OS),Windows_NT)
	os=win
else
    UNAME_S := $(shell uname -s)
    ifeq ($(UNAME_S),Linux)
			os=linux
			LARGS+=" -s"
    else ifeq ($(UNAME_S),Darwin)
			os=mac
			ifeq ($(ARCH),arm64)
				LARGS+=-arch arm64
				CARGS+=-arch arm64
				CCARGS+=-arch arm64
			endif
    endif
endif

.PHONY: help clean

help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9\/_\.-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

v8/include: ## download the v8 headers
	curl -L -o v8-include.tar.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/include.tar.gz
	tar -xvf v8-include.tar.gz
ifneq ($(os),win)
	rm -f v8-include.tar.gz
endif

v8/libv8_monolith.a: ## download the v8 static libary for linux/macos
	curl -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.a.tar.gz
	gzip -d v8/libv8_monolith.a.gz
	rm -f v8/libv8_monolith.a.gz

v8/v8_monolith.lib: ## download the v8 static library for windows
	curl -L -o v8/v8_monolith.lib.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.lib.tar.gz
	gzip -d v8/v8_monolith.lib.gz

main.o: ## compile the main.cc object file
	$(CC) ${CCARGS} ${OPT} -DRUNTIME='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I./v8 -I./v8/include ${WARN} main.cc

builtins.o: ## link all source files and assets into an object file
ifeq (${os},linux)
	$(C) ${CARGS} builtins_linux.S -o builtins.o
else
	$(C) ${CARGS} builtins.S -o builtins.o
endif

${RUNTIME}.o: ## compile runtime into an object file 
	$(CC) ${CCARGS} ${OPT} -DRUNTIME='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I./v8 -I./v8/include ${WARN} ${RUNTIME}.cc

${RUNTIME}: v8/include v8/libv8_monolith.a main.js ${BINDINGS} main.o ${RUNTIME}.o ## link the runtime for linux/macos
	@echo building ${RUNTIME} for ${os} on ${ARCH}
	$(CC) $(LARGS) ${OPT} main.o ${RUNTIME}.o builtins.o ${BINDINGS} v8/libv8_monolith.a -o ${TARGET}

${RUNTIME}.exe: v8/include v8/v8_monolith.lib main.js ## link the runtime for windows
	cl /EHsc /std:c++17 /DRUNTIME='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I./v8 /I./v8/include /c main.cc
	cl /EHsc /std:c++17 /DRUNTIME='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I./v8 /I./v8/include /c ${RUNTIME}.cc
	cl v8/v8_monolith.lib ${RUNTIME}.obj main.obj winmm.lib dbghelp.lib advapi32.lib /link /out:${TARGET}.exe

check: ## run the runtime sanity tests
	./${RUNTIME} test/runtime.js

lib/core/core.a: lib/core/api.js ## build the core binding
	$(MAKE) BINDING=core staticlib

lib/${BINDING}/${BINDING}.a: lib/${BINDING}/api.js
	$(MAKE) BINDING=${BINDING} staticlib

staticlib: v8/include v8/libv8_monolith.a lib/${BINDING}/api.js
	ARCH="${ARCH}" os="${os}" LARGS="${LARGS}" WARN="${WARN}" LO_HOME="${LO_HOME}" CCARGS="${CCARGS}" OPT="${OPT}" $(MAKE) -C lib/${BINDING} ${BINDING}.a

sharedlib: v8/include v8/libv8_monolith.a lib/${BINDING}/${BINDING}.a
	ARCH="${ARCH}" os="${os}" LARGS="${LARGS}" WARN="${WARN}" LO_HOME="${LO_HOME}" CCARGS="${CCARGS}" OPT="${OPT}" $(MAKE) -C lib/${BINDING} ${BINDING}.so

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
	@del /q ${RUNTIME}.exe > NUL 2>&1
	@del /q ${RUNTIME}.exp > NUL 2>&1
	@del /q ${RUNTIME}.lib > NUL 2>&1
else
	rm -f *.o
	rm -f ${RUNTIME}
endif

cleanall:
	$(MAKE) clean
ifeq ($(os),win)
	@rmdir /s /q v8 > NUL 2>&1
else
	rm -fr v8
endif
