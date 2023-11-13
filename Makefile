C=clang
CC=clang++
LARGS=
CCARGS=-std=c++17 -c
CARGS=-c
WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter
OPT=-O3
VERSION=0.0.1
V8_VERSION=12.0
RUNTIME=lo
LO_HOME=$(shell pwd)
MODULES=module/core/core.a
BUILTINS=builtins.S
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
		LARGS += -static-libstdc++ -static-libgcc
		BUILTINS=builtins_linux.S
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
ifeq ($(os),win)
#	@del /q v8-include.tar.gz > NUL 2>&1
else
	rm -f v8-include.tar.gz
endif

v8/libv8_monolith.a:
	curl -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.a.tar.gz
	gzip -d v8/libv8_monolith.a.gz
	rm -f v8/libv8_monolith.a.gz

v8/v8_monolith.lib:
	curl -L -o v8/v8_monolith.lib.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.lib.tar.gz
	gzip -d v8/v8_monolith.lib.gz

${RUNTIME}: v8/include v8/libv8_monolith.a
	@echo building ${RUNTIME} for ${os} on ${ARCH}
ifeq (${os},linux)
	sed 's/__*/_/g' builtins.S > builtins_linux.S
endif
	$(CC) ${CCARGS} ${OPT} -DGLOBALOBJ='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I. -I./v8 -I./v8/include ${WARN} main.cc
	$(CC) ${CCARGS} ${OPT} -DGLOBALOBJ='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I. -I./v8 -I./v8/include ${WARN} ${RUNTIME}.cc
	$(C) ${CARGS} ${BUILTINS} -o builtins.o
	$(CC) $(LARGS) ${OPT} -s main.o ${RUNTIME}.o builtins.o v8/libv8_monolith.a -o ${RUNTIME}

${RUNTIME}.exe: v8/include v8/v8_monolith.lib
	cl /EHsc /std:c++17 /DGLOBALOBJ='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I. /I./v8 /I./v8/include /c main.cc
	cl /EHsc /std:c++17 /DGLOBALOBJ='"${RUNTIME}"' /DVERSION='"${VERSION}"' /I. /I./v8 /I./v8/include /c ${RUNTIME}.cc
	cl v8/v8_monolith.lib ${RUNTIME}.obj main.obj winmm.lib dbghelp.lib advapi32.lib /link /out:${RUNTIME}.exe

test:
	./${RUNTIME}
	./${RUNTIME} 1

module:
	make ${RUNTIME}_HOME=$(pwd) -C module/${MODULE}/ module

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
