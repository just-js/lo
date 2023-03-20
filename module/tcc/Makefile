
C=gcc
CC=g++
MODULE=tcc

.PHONY: help clean


deps/tcc-0.9.27/libtcc.a: ## dependencies
	mkdir -p deps
	curl -L -o deps/tcc-0.9.27.tar.bz2 http://download.savannah.gnu.org/releases/tinycc/tcc-0.9.27.tar.bz2
	tar -jxvf deps/tcc-0.9.27.tar.bz2	-C deps/
	cd deps/tcc-0.9.27 && CFLAGS='-mstackrealign -fPIC -flto -O3' ./configure && cd ../../
	make -C deps/tcc-0.9.27/ libtcc.a


library: libtcc.a ## compile shared library and dependencies
	$(CC) -c -flto -g -O3 -fPIC -std=c++17 -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I$(SPIN_HOME) -I$(SPIN_HOME)/deps/v8/include -march=native -mtune=native -Wall -Wextra -Wno-unused-parameter -o $(MODULE).o $(MODULE).cc
	ar crsT $(MODULE).a $(MODULE).o
	$(CC) -flto -g -O3 -shared -flto -pthread -m64 -Wl,--start-group libtcc.a $(MODULE).o -Wl,--end-group -Wl,-soname=$(MODULE).so -ltcc -o $(MODULE).so
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

