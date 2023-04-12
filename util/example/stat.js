import { Library, Types, tcc } from 'lib/ffi.js'
import { run } from 'lib/bench.js'

/*
https://github.com/whotwagner/statx-fun/blob/master/statx.c
https://github.com/pranith/nolibc/blob/master/nolibc.h
https://man7.org/linux/man-pages/man2/syscall.2.html
https://syscalls.w3challs.com/


*/

const CSource = `
#include <errno.h>

void* st;

#define AT_EMPTY_PATH 0x00001000U
#define STATX_SIZE 0x00000200U

void ffi_register (void* sta) {
  st = sta;
}

int ffi_fstat (int fd) {
  int ret;
  asm volatile
  (
    "syscall"
    : "=a" (ret)
    : "0"(5), "D"(fd), "S"(st), "d"(0), "r"(0), "m"(0), "m"(0)
    : "rcx", "r11", "memory"
  );
  if (ret < 0) {
    errno = -ret;
    return -1;
  };
  return ret;
}

int ffi_statx (int fd) {
  long _ret;
  register long _num  asm("rax") = (long)332;
	register long _arg1 asm("rdi") = (long)(fd);
	register long _arg2 asm("rsi") = (long)("");
	register long _arg3 asm("rdx") = (long)(AT_EMPTY_PATH);
	register long _arg4 asm("r10") = (long)(STATX_SIZE);
	register long _arg5 asm("r8")  = (long)(st);  
	asm volatile (
		"syscall\n"
		: "=a" (_ret), "=r"(_arg4), "=r"(_arg5)
		: "r"(_arg1), "r"(_arg2), "r"(_arg3), "r"(_arg4), "r"(_arg5), "0"(_num)
		: "rcx", "r9", "r11", "memory", "cc"
	);       
  return (int)_ret;
}
`

const stat = new Uint8Array(256)
const st = new BigUint64Array(stat.buffer)

const asm = (new Library()).open().compile(CSource).bind({
  register: {
    parameters: ['buffer'],
    result: 'void',
    name: 'ffi_register',
    internal: true
  },
  fstat: {
    parameters: ['i32'],
    result: 'i32',
    name: 'ffi_fstat',
    internal: true
  },
  statx: {
    parameters: ['i32'],
    result: 'i32',
    name: 'ffi_statx',
    internal: true
  },
})

const { fs, assert } = spin

const O_RDONLY = 0
const fd = fs.open('scc.txt', O_RDONLY)
assert(fd > 0)
//asm.register(stat)
//assert(asm.fstat(fd) === 0)
//console.log(st)
assert(asm.statx(fd) === 0)
console.log(stat)
//run('ffi_fstat', () => asm.fstat(fd), 1000000, 10)
//run('ffi_statx', () => asm.statx(fd), 1000000, 10)