// A mutex on one int32 in a SharedArrayBuffer, usable from any isolate that
// has the same buffer (send it with lo.serialize: the backing store is shared
// and reference counted). 0 is free, 1 locked, 2 locked with waiters.
//
// lock: CAS, then spin re-reading the word, then mark it contended and sleep
// in Atomics.wait. unlock: exchange to 0, wake one waiter only if contended.
// No callback per lock (unlike Atomics.Mutex.lock), so the critical section is
// plain inline code. Atomics.wait is interruptible, so a blocked thread still
// reaches safepoints (shared heap GC) and can be terminated.
//
// Not fair (a thread that just unlocked can take the lock straight back), not
// recursive, and unlock doesn't check the owner.
//
// Cells are bare isolates without a module loader: give them the class as
// source, `${Mutex.toString()}`.

class Mutex {
  // spins re-reading the word before sleeping
  static spins = 100

  constructor (sab = new SharedArrayBuffer(4), index = 0) {
    this.i32 = new Int32Array(sab)
    this.index = index
  }

  get buffer () {
    return this.i32.buffer
  }

  tryLock () {
    return Atomics.compareExchange(this.i32, this.index, 0, 1) === 0
  }

  lock () {
    const { i32, index } = this
    if (Atomics.compareExchange(i32, index, 0, 1) === 0) return this
    for (let spins = 0; spins < Mutex.spins; spins++) {
      if (Atomics.load(i32, index) === 0 &&
        Atomics.compareExchange(i32, index, 0, 1) === 0) return this
    }
    while (Atomics.exchange(i32, index, 2) !== 0) Atomics.wait(i32, index, 2)
    return this
  }

  unlock () {
    const { i32, index } = this
    if (Atomics.exchange(i32, index, 0) === 2) Atomics.notify(i32, index, 1)
  }

  [Symbol.dispose] () {
    this.unlock()
  }
}

export { Mutex }
