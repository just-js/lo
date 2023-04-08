const api = {
  begin: {
    result: 'pointer',
    rpointer: 'rs_job_t*',
    parameters: ['u32', 'u32', 'i32'],
    casts: [, , '(rs_magic_number)'],
    name: 'rs_sig_begin'
  },
  free: {
    parameters: ['pointer'],
    pointers: ['rs_job_t*'],
    result: 'i32',
    name: 'rs_job_free'
  },
  iter: {
    parameters: ['pointer', 'buffer'],
    pointers: ['rs_job_t*', 'rs_buffers_t*'],
    result: 'i32',
    name: 'rs_job_iter'
  },
  args: {
    parameters: ['u32', 'u32array', 'u32array', 'u32array'],
    pointers: [, 'rs_magic_number*', 'size_t*', 'size_t*'],
    result: 'i32',
    name: 'rs_sig_args'
  }
}

const name = 'rsync'
const includes = ['deps/librsync-2.3.4/src/librsync.h']
const libs = []
const obj = ['librsync.a']

const make = `
wget https://github.com/librsync/librsync/releases/download/v2.3.4/librsync-2.3.4.tar.gz
tar -zxvf librsync-2.3.4.tar.gz 
cd librsync-2.3.4/
cmake .
make -j 6
cd ..
ar -crsT librsync.a  deps/librsync-2.3.4/CMakeFiles/rsync.dir/src/*.
`

export { name, api, includes, libs, obj }
