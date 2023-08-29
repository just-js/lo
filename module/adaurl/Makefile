
C=gcc
CC=g++
MODULE=adaurl

.PHONY: help clean


libada.a: # dependencies
	mkdir -p deps
	curl -L -o deps/adaurl.tar.gz "https://codeload.github.com/ada-url/ada/tar.gz/v2.4.0"
	tar -zxvf deps/adaurl.tar.gz -C deps/
	cd deps/ada-2.4.0/ && mkdir -p build && cd build && cmake ../ && make
	cp deps/ada-2.4.0/build/_deps/simdjson/libsimdjson.a ./
	cp deps/ada-2.4.0/build/src/libada.a ./
	cp deps/ada-2.4.0/include/ada_c.h ./

library: libada.a libsimdjson.a ## compile shared library and dependencies
	$(CC) -c -flto -g -O3 -fPIC -std=c++17 -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I$(SPIN_HOME) -I$(SPIN_HOME)/deps/v8/include -march=native -mtune=native -Wall -Wextra -Wno-unused-parameter -o $(MODULE).o $(MODULE).cc
	ar crsT $(MODULE).a $(MODULE).o
	$(CC) -flto -g -O3 -shared -flto -pthread -m64 -static-libstdc++ -static-libgcc -Wl,--start-group libada.a libsimdjson.a $(MODULE).o -Wl,--end-group -Wl,-soname=$(MODULE).so -o $(MODULE).so
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

