import {
  write_flags, read_flags, write_mode, dir_flags,
  is_dir, is_file, mkdir_all, rmdir_all, mkdir_all_safe, file_size, 
  readdir_sync, read_entry
} from 'lib/fs.js'

const { core } = lo
const { opendir, readdir, closedir } = core

const { assert } = lo

assert(is_dir('./'))
assert(is_dir('lib'))
assert(is_file('test/fs.js'))
assert(!is_file('foo.js'))
assert(file_size('LICENSE') === 1071)
const entries = readdir_sync('runtime')
assert(entries.length === 8)
assert(entries[0].path === 'runtime')
//assert(entries[0].name === 'base.config.js')
assert(entries[0].isFile === true)
//mkdir_all_safe('foo/bar/baz')
//rmdir_all('foo/bar/baz')
const dir = opendir('lib')
let next = readdir(dir)
while (next) {
  const entry = read_entry(next)
  next = readdir(dir)
}
assert(closedir(dir) === 0)
//const entries = readdir_sync('lib', [], { recursive: false })
