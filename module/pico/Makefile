
C=gcc
CC=g++
MODULE=pico

.PHONY: help clean


library: ## compile shared library and dependencies
	$(C) -c -fPIC -g -O3 -Wall -Wextra -m64 -msse4 -std=c11 -o picohttpparser.o picohttpparser.c
	$(C) -c -fPIC -g -O3 -Wall -Wextra -m64 -msse4 -o pico_c.o pico.c
	$(CC) -c -flto -g -O3 -fPIC -std=c++17 -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I$(SPIN_HOME) -I$(SPIN_HOME)/deps/v8/include -msse4 -Wall -Wextra -Wno-unused-parameter -o $(MODULE).o $(MODULE).cc
	$(CC) -flto -g -O3 -shared -flto -pthread -m64 -static-libstdc++ -static-libgcc -Wl,--start-group pico.o pico_c.o picohttpparser.o -Wl,--end-group -Wl,-soname=$(MODULE).so -o $(MODULE).so
#	$(CC) -c -flto -g -O3 -fPIC -std=c++17 -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I$(SPIN_HOME) -I$(SPIN_HOME)/deps/v8/include -march=native -mtune=native -Wall -Wextra -Wno-unused-parameter -o $(MODULE).o $(MODULE).cc
#	ar crsT $(MODULE).a $(MODULE).o
#	$(CC) -flto -g -O3 -shared -flto -pthread -m64 -Wl,--start-group $(MODULE).o -Wl,--end-group -Wl,-soname=$(MODULE).so -o $(MODULE).so
#	objcopy --only-keep-debug $(MODULE).so $(MODULE).so.debug
#	strip --strip-debug --strip-unneeded $(MODULE).so

clean: ## tidy up
	rm -f $(MODULE).o
	rm -f $(MODULE).so
	rm -f $(MODULE).so.debug
	
all: ## make all
	make clean
	make library

.DEFAULT_GOAL := help

