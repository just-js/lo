C=clang
CC=clang++
LARGS=-rdynamic
CCARGS=-std=c++17 -c
CARGS=-c
WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter
OPT=-O3
VERSION=0.0.1
V8_VERSION=12.0
RUNTIME=lo
LO_HOME=$(shell pwd)
BINDINGS=binding/core/core.a
ARCH=x64
os=linux

ifeq ($(OS),Windows_NT)
	os=win
else
    UNAME_S := $(shell uname -s)
    ifeq ($(UNAME_S),Linux)
			C=gcc
			CC=g++
			os=linux
			LARGS += -s
    else ifeq ($(UNAME_S),Darwin)
			os=mac
			ifeq ($(ARCH),arm64)
				LARGS+=-arch arm64
				CARGS+=-arch arm64
				CCARGS+=-arch arm64
			endif
    endif
endif

v8/include:
	curl -L -o v8-include.tar.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/include.tar.gz
	tar -xvf v8-include.tar.gz
ifneq ($(os),win)
	rm -f v8-include.tar.gz
endif

v8/libv8_monolith.a:
	curl -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.a.tar.gz
	gzip -d v8/libv8_monolith.a.gz
	rm -f v8/libv8_monolith.a.gz

v8/v8_monolith.lib:
	curl -L -o v8/v8_monolith.lib.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.lib.tar.gz
	gzip -d v8/v8_monolith.lib.gz

${RUNTIME}: v8/include v8/libv8_monolith.a main.js ${BINDINGS}
	@echo building ${RUNTIME} for ${os} on ${ARCH}
ifeq (${os},linux)
	sed 's/__*/_/g' builtins.S > builtins_linux.S
	$(C) ${CARGS} builtins_linux.S -o builtins.o
	rm -f builtins_linux.S
else
	$(C) ${CARGS} builtins.S -o builtins.o
endif
	$(CC) ${CCARGS} ${OPT} -DRUNTIME='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I./v8 -I./v8/include ${WARN} main.cc
	$(CC) ${CCARGS} ${OPT} -DRUNTIME='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I./v8 -I./v8/include ${WARN} ${RUNTIME}.cc
	$(CC) $(LARGS) ${OPT} main.o ${RUNTIME}.o builtins.o ${BINDINGS} v8/libv8_monolith.a -o ${RUNTIME}

${RUNTIME}.exe: v8/include v8/v8_monolith.lib main.js
	cl /EHsc /std:c++17 /DRUNTIME='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I./v8 /I./v8/include /c main.cc
	cl /EHsc /std:c++17 /DRUNTIME='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I./v8 /I./v8/include /c ${RUNTIME}.cc
	cl v8/v8_monolith.lib ${RUNTIME}.obj main.obj winmm.lib dbghelp.lib advapi32.lib /link /out:${RUNTIME}.exe

test:
	./${RUNTIME} test

binding/core/core.a:
	$(MAKE) BINDING=core staticlib

binding/${BINDING}/${BINDING}.a:
	$(MAKE) BINDING=${BINDING} staticlib

staticlib: v8/include v8/libv8_monolith.a
	ARCH="${ARCH}" os="${os}" LARGS="${LARGS}" WARN="${WARN}" LO_HOME="${LO_HOME}" CCARGS="${CCARGS}" OPT="${OPT}" $(MAKE) -C binding/${BINDING}/ ${BINDING}.a

sharedlib: v8/include v8/libv8_monolith.a binding/${BINDING}/${BINDING}.a
	ARCH="${ARCH}" os="${os}" LARGS="${LARGS}" WARN="${WARN}" LO_HOME="${LO_HOME}" CCARGS="${CCARGS}" OPT="${OPT}" $(MAKE) -C binding/${BINDING}/ ${BINDING}.so

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
