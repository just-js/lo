// Standard test.js entrypoint (`lo lib/fsmount/test.js`) -- real
// constants and a real syscall against the abi-target build, not just a
// "does it compile" check. See doc/WORK.E.1.md's "Result" section (E.9)
// for why this was the first real binding ported past foo/foo_abi.

const { assert } = lo

async function test () {
  const { fsmount } = lo.load('fsmount')

  // umount flags (small, well-known values -- real constants, not guesses)
  assert(fsmount.MNT_FORCE === 1, 'MNT_FORCE')
  assert(fsmount.MNT_DETACH === 2, 'MNT_DETACH')
  // mount flags
  assert(fsmount.MS_RDONLY === 1, 'MS_RDONLY')
  assert(fsmount.MS_NOSUID === 2, 'MS_NOSUID')

  // a real syscall against a path that can't exist -- expect the real
  // ENOENT failure (-1), not a crash and not a false success
  assert(fsmount.umount('/nonexistent-path-xyz') === -1, 'umount(nonexistent)')

  console.log('fsmount: ok')
}

export { test }
