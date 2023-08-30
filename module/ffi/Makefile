
C=gcc
CC=g++
MODULE=ffi

.PHONY: help clean

deps:
	mkdir -p deps
	curl -L -o libffi.tar.gz https://github.com/libffi/libffi/archive/refs/tags/v3.4.2.tar.gz
	tar -zxvf libffi.tar.gz -C deps/
	rm -f libffi.tar.gz

libffi.a: deps
	cd deps/libffi-3.4.2 && ./autogen.sh && CFLAGS='-mstackrealign -fPIC -flto -O3' ./configure --enable-static=yes --enable-shared=no --disable-docs && make
	cp deps/libffi-3.4.2/x86_64-pc-linux-gnu/include/ffi.h ./
	cp deps/libffi-3.4.2/x86_64-pc-linux-gnu/.libs/libffi.a ./

library: libffi.a ## compile shared library and dependencies
	$(CC) -c -flto -g -O3 -fPIC -std=c++17 -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I$(SPIN_HOME) -I$(SPIN_HOME)/deps/v8/include -march=native -mtune=native -Wall -Wextra -Wno-unused-parameter -o $(MODULE).o $(MODULE).cc
	ar crsT $(MODULE).a $(MODULE).o
	$(CC) -flto -g -O3 -shared -flto -pthread -m64 -Wl,--start-group libffi.a $(MODULE).o -Wl,--end-group -Wl,-soname=$(MODULE).so -o $(MODULE).so
	objcopy --only-keep-debug $(MODULE).so $(MODULE).so.debug
	strip --strip-debug --strip-unneeded $(MODULE).so

clean: ## tidy up
	rm -f $(MODULE).o
	rm -f $(MODULE).so
	rm -f $(MODULE).so.debug
	
all: ## make all
	make clean
	make library

.DEFAULT_GOAL := help

