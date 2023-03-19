const api = {
  tcc_new: {
    parameters: [],
    result: 'pointer'
  },
  tcc_set_output_type: {
    parameters: ['pointer', 'i32'],
    pointers: ['TCCState*'],
    result: 'i32'
  },
  tcc_set_options: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'void'
  },
  tcc_add_include_path: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_add_file: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_compile_string: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_relocate: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'void*'],
    result: 'i32'
  },
  tcc_get_symbol: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'pointer'
  },
  tcc_add_symbol: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*', 'const void*'],
    result: 'i32'
  }
}

const TCC_VERSION='0.9.27'

const make = `
deps/tcc-${TCC_VERSION}/libtcc.a: ## dependencies
	mkdir -p deps
	curl -L -o deps/tcc-${TCC_VERSION}.tar.bz2 http://download.savannah.gnu.org/releases/tinycc/tcc-${TCC_VERSION}.tar.bz2
	tar -jxvf deps/tcc-${TCC_VERSION}.tar.bz2	-C deps/
	cd deps/tcc-${TCC_VERSION} && CFLAGS='-mstackrealign -fPIC -flto -O3' ./configure && cd ../../
	make -C deps/tcc-${TCC_VERSION}/ libtcc.a

`
const name = 'tcc'
const includes = ['libtcc.h']
const libs = []
const obj = []

export { api, includes, name, libs, obj, make }
