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
SPIN_HOME=$(shell pwd)
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
	rm -f v8-include.tar.gz

v8/libv8_monolith.a:
ifeq ($(os),win)
	curl -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.lib.tar.gz
else
	curl -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${ARCH}.a.tar.gz
endif
	gunzip v8/libv8_monolith.a.gz
	rm -f v8/libv8_monolith.a.gz

${RUNTIME}: v8/include v8/libv8_monolith.a
	@echo building ${RUNTIME} for ${os} on ${ARCH}
	$(CC) ${CCARGS} ${OPT} -DGLOBALOBJ='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I. -I./v8 -I./v8/include ${WARN} main.cc
	$(CC) ${CCARGS} ${OPT} -DGLOBALOBJ='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I. -I./v8 -I./v8/include ${WARN} spin.cc
	$(C) ${CARGS} ${BUILTINS} -o builtins.o
	$(CC) $(LARGS) ${OPT} -s main.o spin.o builtins.o v8/libv8_monolith.a -o ${RUNTIME}

test:
	./lo
	./lo 1

module:
	make SPIN_HOME=$(pwd) -C module/${MODULE}/ module

clean:
	rm -f *.o
	rm -f ${RUNTIME}

cleanall:
	$(MAKE) clean
	rm -fr v8
