
C=gcc
CC=g++
MODULE=libssl

.PHONY: help clean


deps:
	mkdir -p deps
	curl -L -o openssl-1.1.1t.tar.gz https://www.openssl.org/source/openssl-1.1.1t.tar.gz
	tar -zxvf openssl-1.1.1t.tar.gz -C deps
	rm openssl-1.1.1t.tar.gz

libcrypto.a libssl_o.a: deps
	cd deps/openssl-1.1.1t/ &&	CFLAGS='-fPIC -mtune=native -m64 -O3' ./config shared zlib no-ssl no-tls1 no-dtls no-aria no-bf no-blake2 no-camellia no-cast no-chacha no-cmac no-des no-idea no-mdc2 no-ocb no-poly1305 no-rc2 no-scrypt no-seed no-siphash no-sm3 no-sm4 no-whirlpool no-afalgeng no-deprecated no-capieng no-cms no-comp no-dgram no-threads && make clean build_generated && make -j 6
	cp deps/openssl-1.1.1t/libssl.a ./libssl_o.a
	cp deps/openssl-1.1.1t/libcrypto.a ./

library: libssl_o.a libcrypto.a ## compile shared library and dependencies
	$(CC) -c -flto -g -O3 -fPIC -std=c++17 -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I$(SPIN_HOME) -I$(SPIN_HOME)/deps/v8/include -march=native -mtune=native -Wall -Wextra -Wno-unused-parameter -o $(MODULE).o $(MODULE).cc
	ar crsT $(MODULE).a $(MODULE).o
	$(CC) -flto -g -O3 -shared -flto -pthread -m64 -Wl,--start-group libssl_o.a libcrypto.a $(MODULE).o -Wl,--end-group -Wl,-soname=$(MODULE).so -o $(MODULE).so
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

