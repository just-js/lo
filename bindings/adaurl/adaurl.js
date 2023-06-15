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

const make = `
libada.a: # dependencies
	mkdir -p deps
	curl -L -o deps/adaurl.tar.gz "https://codeload.github.com/ada-url/ada/tar.gz/v2.4.0"
	tar -zxvf deps/adaurl.tar.gz -C deps/
	cd deps/ada-2.4.0/ && mkdir -p build && cd build && cmake ../ && make
	cp deps/ada-2.4.0/build/_deps/simdjson/libsimdjson.a ./
	cp deps/ada-2.4.0/build/src/libada.a ./
	cp deps/ada-2.4.0/include/ada_c.h ./
`

export { name, api, make, obj, includes }
