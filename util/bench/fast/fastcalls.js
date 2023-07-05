import { bind, fastcall } from 'lib/fast.js'
import { Bench } from 'lib/bench.js'
import { dump } from 'lib/binary.js'

const { assert, dlsym, dlopen } = spin

const handle = dlopen('./bug.so', 1)
assert(handle)

const args = (new Array(30)).fill('i32')

const noop = bind(dlsym(handle, 'noop'), 'void', [])
const add1 = bind(dlsym(handle, 'add1'), 'i32', args.slice(0, 1))
const add2 = bind(dlsym(handle, 'add2'), 'i32', args.slice(0, 2))
const add3 = bind(dlsym(handle, 'add3'), 'i32', args.slice(0, 3))
const add4 = bind(dlsym(handle, 'add4'), 'i32', args.slice(0, 4))
const add5 = bind(dlsym(handle, 'add5'), 'i32', args.slice(0, 5))
const add6 = bind(dlsym(handle, 'add6'), 'i32', args.slice(0, 6))
const add7 = bind(dlsym(handle, 'add7'), 'i32', args.slice(0, 7))
const add8 = bind(dlsym(handle, 'add8'), 'i32', args.slice(0, 8))
const add9 = bind(dlsym(handle, 'add9'), 'i32', args.slice(0, 9))
const add10 = bind(dlsym(handle, 'add10'), 'i32', args.slice(0, 10))
const add11 = bind(dlsym(handle, 'add11'), 'i32', args.slice(0, 11))
const add12 = bind(dlsym(handle, 'add12'), 'i32', args.slice(0, 12))
const add13 = bind(dlsym(handle, 'add13'), 'i32', args.slice(0, 13))
const add14 = bind(dlsym(handle, 'add14'), 'i32', args.slice(0, 14))
const add15 = bind(dlsym(handle, 'add15'), 'i32', args.slice(0, 15))
const add16 = bind(dlsym(handle, 'add16'), 'i32', args.slice(0, 16))
const add17 = bind(dlsym(handle, 'add17'), 'i32', args.slice(0, 17))
const add18 = bind(dlsym(handle, 'add18'), 'i32', args.slice(0, 18))
const add19 = bind(dlsym(handle, 'add19'), 'i32', args.slice(0, 19))
const add20 = bind(dlsym(handle, 'add20'), 'i32', args.slice(0, 20))

assert(noop() === undefined)
assert(add1(1) === 2)
assert(add2(1, 2) === 3)
assert(add3(1, 2, 3) === 6)
assert(add4(1, 2, 3, 4) === 10)
assert(add5(1, 2, 3, 4, 5) === 15)
assert(add6(1, 2, 3, 4, 5, 6) === 21)
assert(add7(1, 2, 3, 4, 5, 6, 7) === 28)
assert(add8(1, 2, 3, 4, 5, 6, 7, 8) === 36)
assert(add9(1, 2, 3, 4, 5, 6, 7, 8, 9) === 45)
assert(add10(1, 2, 3, 4, 5, 6, 7, 8, 9, 10) === 55)
assert(add11(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11) === 66)
assert(add12(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12) === 78)
assert(add13(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13) === 91)
assert(add14(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14) === 105)
assert(add15(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15) === 120)
assert(add16(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16) === 136)
assert(add17(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17) === 153)
assert(add18(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18) === 171)
assert(add19(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19) === 190)
assert(add20(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20) === 210)

const repeat = 3
const runs = 100000000
const bencher = new Bench()

while (1) {

for (let j = 0; j < repeat; j++) {
  bencher.start('noop')
  for (let i = 0; i < runs; i++) {
    noop()  
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add1')
  for (let i = 0; i < runs; i++) {
    add1(1)  
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add2')
  for (let i = 0; i < runs; i++) {
    add2(1, 2)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add3')
  for (let i = 0; i < runs; i++) {
    add3(1, 2, 3)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add4')
  for (let i = 0; i < runs; i++) {
    add4(1, 2, 3, 4)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add5')
  for (let i = 0; i < runs; i++) {
    add5(1, 2, 3, 4, 5)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add6')
  for (let i = 0; i < runs; i++) {
    add6(1, 2, 3, 4, 5, 6)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add7')
  for (let i = 0; i < runs; i++) {
    add7(1, 2, 3, 4, 5, 6, 7)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add8')
  for (let i = 0; i < runs; i++) {
    add8(1, 2, 3, 4, 5, 6, 7, 8)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add9')
  for (let i = 0; i < runs; i++) {
    add9(1, 2, 3, 4, 5, 6, 7, 8, 9)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add10')
  for (let i = 0; i < runs; i++) {
    add9(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add11')
  for (let i = 0; i < runs; i++) {
    assert(add11(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11) === 66)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add12')
  for (let i = 0; i < runs; i++) {
    assert(add12(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12) === 78)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add13')
  for (let i = 0; i < runs; i++) {
    assert(add13(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13) === 91)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add14')
  for (let i = 0; i < runs; i++) {
    assert(add14(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14) === 105)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add15')
  for (let i = 0; i < runs; i++) {
    assert(add15(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15) === 120)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add16')
  for (let i = 0; i < runs; i++) {
    assert(add16(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16) === 136)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add17')
  for (let i = 0; i < runs; i++) {
    assert(add17(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17) === 153)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add18')
  for (let i = 0; i < runs; i++) {
    assert(add18(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18) === 171)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add19')
  for (let i = 0; i < runs; i++) {
    assert(add19(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19) === 190)
  }
  bencher.end(runs)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('add20')
  for (let i = 0; i < runs; i++) {
    assert(add20(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20) === 210)
  }
  bencher.end(runs)
}

}
