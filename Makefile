C=clang
CC=clang++
LARGS=
WARN=-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter
STD=c++17
OPT=-O3
VERSION=0.0.1
V8_VERSION=12.0
RUNTIME=lo
SPIN_HOME=$(shell pwd)
MODULES=module/core/core.a
BUILTINS=builtins.S

os=linux
arch=x64

ifeq ($(OS),Windows_NT)
	os=win
	arch=x64
else
    UNAME_S := $(shell uname -s)
    ifeq ($(UNAME_S),Linux)
		os=linux
		LARGS += -static-libstdc++ -static-libgcc
		BUILTINS=builtins_linux.S
    else ifeq ($(UNAME_S),Darwin)
		os=mac
    endif
    UNAME_M := $(shell uname -m)
    ifneq ($(UNAME_M),x86_64)
		arch=arm64
    endif
endif

v8/include:
	curl -L -o v8-include.tar.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/include.tar.gz
	tar -xvf v8-include.tar.gz
	rm -f v8-include.tar.gz

v8/libv8_monolith.a:
ifeq ($(os),win)
	curl -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${arch}.lib.tar.gz
else
	curl -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_VERSION}/libv8_monolith-${os}-${arch}.a.tar.gz
endif
	gunzip v8/libv8_monolith.a.gz
	rm -f v8/libv8_monolith.a.gz

${RUNTIME}: v8/include v8/libv8_monolith.a
	@echo building ${RUNTIME} for ${os} on ${arch}
	$(CC) -std=${STD} ${OPT} -c -DGLOBALOBJ='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I. -I./v8 -I./v8/include ${WARN} main.cc
	$(CC) -std=${STD} ${OPT} -c -DGLOBALOBJ='"${RUNTIME}"' -DVERSION='"${VERSION}"' -I. -I./v8 -I./v8/include ${WARN} spin.cc
	$(C) ${BUILTINS} -c -o builtins.o
	$(CC) $(LARGS) ${OPT} -s main.o spin.o builtins.o v8/libv8_monolith.a -o ${RUNTIME}

module:
	make SPIN_HOME=$(pwd) -C module/${MODULE}/ module

clean:
	rm -f *.o
	rm -f ${RUNTIME}

cleanall:
	$(MAKE) clean
	rm -fr v8
