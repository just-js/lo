C=clang
CC=clang++
MODULES=module/load/load.a module/fs/fs.a module/epoll/epoll.a module/system/system.a
SPIN_HOME=$(shell pwd)
V8_RELEASE=12.0
VERSION=0.0.1
GLOBALOBJ=spin
#LARGS=-static-libstdc++ -static-libgcc 
LARGS=-static

v8/include:
	curl -L -o v8-include.tar.gz https://github.com/just-js/v8/releases/download/${V8_RELEASE}/include.tar.gz
	tar -xvf v8-include.tar.gz
	rm -f v8-include.tar.gz

v8/libv8_monolith.a:
	curl -L -o v8/libv8_monolith.a.gz https://github.com/just-js/v8/releases/download/${V8_RELEASE}/libv8_monolith-linux-x64.a.tar.gz
	gunzip v8/libv8_monolith.a.gz
	rm -f v8/libv8_monolith.a.gz

linux-arm64: v8/include v8/libv8_monolith.a
ifneq (,$(wildcard ./libv8_monolith.a))
else
	cp zips/libv8_monolith-linux-arm64.a.zip ./
	unzip libv8_monolith-linux-arm64.a.zip
endif
	$(CC) -fPIC -fno-rtti -g -O3 -c -DGLOBALOBJ='"spin"' -DVERSION='"0.1.16"' -std=c++17 -DV8_NO_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I./deps/v8/include -I./deps/v8 -Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter main.cc
	$(CC) -fPIC -fno-rtti -g -O3 -c -DGLOBALOBJ='"spin"' -DVERSION='"0.1.16"' -std=c++17 -DV8_NO_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I./deps/v8/include -I./deps/v8 -Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter spin.cc
	SPIN_HOME="$(SPIN_HOME)" $(MAKE) -C module/load/ library
	SPIN_HOME="$(SPIN_HOME)" $(MAKE) -C module/fs/ library
	SPIN_HOME="$(SPIN_HOME)" $(MAKE) -C module/epoll/ library
	SPIN_HOME="$(SPIN_HOME)" $(MAKE) -C module/system/ library
	$(C) builtins-linux.S -c -o builtins.o
	$(CC) -static -fPIC -fno-rtti -g -O3 main.o spin.o builtins.o libv8_monolith.a ${MODULES} -o spin

linux-x64: v8/include v8/libv8_monolith.a
	$(CC) -std=c++17 -fno-rtti -O3 -c -DGLOBALOBJ='"${GLOBALOBJ}"' -DVERSION='"${VERSION}"' -I. -I./v8 -I./v8/include -Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter main.cc
	$(CC) -std=c++17 -fno-rtti -O3 -c -DGLOBALOBJ='"${GLOBALOBJ}"' -DVERSION='"${VERSION}"' -I. -I./v8 -I./v8/include -Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter spin.cc
	$(C) builtins.S -c -o builtins.o
	$(CC) $(LARGS) -s -fno-rtti -O3 -rdynamic main.o spin.o builtins.o v8/libv8_monolith.a -o spin

macos-x64:
ifneq (,$(wildcard ./libv8_monolith.a))
else
	cp zips/libv8_monolith-mac-x64.a.zip ./
	unzip libv8_monolith-mac-x64.a.zip
endif
	$(CC) -fno-rtti -g -O3 -c -DGLOBALOBJ='"spin"' -DVERSION='"0.1.16"' -std=c++17 -DV8_NO_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I./deps/v8/include -I./deps/v8 -Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter main.cc
	$(CC) -fno-rtti -g -O3 -c -DGLOBALOBJ='"spin"' -DVERSION='"0.1.16"' -std=c++17 -DV8_NO_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I./deps/v8/include -I./deps/v8 -Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter spin.cc
	$(C) builtins-macos.S -c -o builtins.o
	$(CC) -fno-rtti -g -O3 -rdynamic main.o spin.o builtins.o libv8_monolith.a -o spin

macos-arm64:
ifneq (,$(wildcard ./libv8_monolith.a))
else
	cp zips/libv8_monolith-mac-arm64.a.zip ./
	unzip libv8_monolith-mac-arm64.a.zip
endif
	$(CC) -arch arm64 -fno-rtti -g -O3 -c -DGLOBALOBJ='"spin"' -DVERSION='"0.1.16"' -std=c++17 -DV8_NO_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I./deps/v8/include -I./deps/v8 -Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter main.cc
	$(CC) -arch arm64 -fno-rtti -g -O3 -c -DGLOBALOBJ='"spin"' -DVERSION='"0.1.16"' -std=c++17 -DV8_NO_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -I. -I./deps/v8/include -I./deps/v8 -Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter spin.cc
	$(C) -arch arm64 builtins-macos.S -c -o builtins.o
	$(CC) -arch arm64 -fno-rtti -g -O3 -rdynamic main.o spin.o builtins.o libv8_monolith.a -o spin

library:
	make SPIN_HOME=$(pwd) -C module/fs/ library

clean:
	rm -f *.a
	rm -f *.o
	rm -f spin
	rm -f *.zip

cleanall:
	$(MAKE) clean
	rm -fr v8
