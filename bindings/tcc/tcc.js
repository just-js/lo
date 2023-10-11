const api = {
  tcc_new: {
    parameters: [],
    result: 'pointer'
  },
  tcc_delete: {
    parameters: ['pointer'],
    pointers: ['TCCState*'],
    result: 'void'
  },
  tcc_set_output_type: {
    parameters: ['pointer', 'i32'],
    pointers: ['TCCState*'],
    result: 'i32'
  },
  tcc_set_options: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'void'
  },
  tcc_add_library_path: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_add_library: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_add_include_path: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_add_file: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_compile_string: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_relocate: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'void*'],
    result: 'i32'
  },
  tcc_get_symbol: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'pointer'
  },
  tcc_add_symbol: {
    parameters: ['pointer', 'string', 'pointer'],
    pointers: ['TCCState*', 'const char*', 'const void*'],
    result: 'i32'
  },
  tcc_output_file: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  }
}

const TCC_VERSION='0.9.27'

const make = `
# TODO: you need to do 'sudo apt install libtcc-dev' to get this to work as it needs a system lib to link against 
# TODO: you also seem to need to have the tcc system library here. this sucks. /usr/local/lib/tcc/libtcc1.a

libtcc.a: ## dependencies
	mkdir -p deps
	curl -L -o deps/tcc-${TCC_VERSION}.tar.bz2 http://download.savannah.gnu.org/releases/tinycc/tcc-${TCC_VERSION}.tar.bz2
	tar -jxvf deps/tcc-${TCC_VERSION}.tar.bz2	-C deps/
	cd deps/tcc-${TCC_VERSION} && CFLAGS='-mstackrealign -fPIC -flto -O3' ./configure && cd ../../
	make -C deps/tcc-${TCC_VERSION}/ libtcc.a
	cp deps/tcc-0.9.27/libtcc.a ./
	cp deps/tcc-0.9.27/libtcc.h ./

`
const name = 'tcc'
const includes = ['libtcc.h']
const libs = ['tcc']
const obj = ['libtcc.a']

export { api, includes, name, libs, obj, make }
