const api = {
  parse: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'pointer',
    name: 'ada_parse'
  }
}

const name = 'adaurl'

const includes = ['ada_c.h']
const obj = ['libada.a', 'libsimdjson.a']

/*
cmake -B build
cmake --build build
singleheader/amalgamate.py 
g++ -fPIC -c singleheader/ada.cpp -o ada.o
g++ -shared ada.o -o ada.so

*/

const make = `
libada.a: # dependencies
	mkdir -p deps
	curl -L -o deps/adaurl.tar.gz "https://codeload.github.com/ada-url/ada/tar.gz/v2.6.7"
	tar -zxvf deps/adaurl.tar.gz -C deps/
	cd deps/ada-2.6.7/ && mkdir -p build && cd build && cmake ../ && make
	cp deps/ada-2.6.7/build/_deps/simdjson/libsimdjson.a ./
	cp deps/ada-2.6.7/build/src/libada.a ./
	cp deps/ada-2.6.7/include/ada_c.h ./
`

export { name, api, make, obj, includes }
