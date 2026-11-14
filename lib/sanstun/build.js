import { fetch } from 'lib/curl.js'
import { exec } from 'lib/proc.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'

const { assert, getenv, core } = lo
const { mkdir, read_file, write_file, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH } = core

// sanstun (github.com/firezone/sanstun, sans-IO WireGuard in Rust) through the C ABI crate in capi/ (sanstun.h is
// its contract). Needs Rust + cargo and a C compiler (ring builds C/asm with $CC).
//   SANSTUN_REF=<commit or tag>   sanstun source to build against (default sanstun_ref below), fetched into
//                                 deps/sanstun once. Delete deps/sanstun to switch.
//   CARGO=<cargo command>         default cargo
//   SANSTUN_JOBS=<n>              cargo -j (default 1)
//   CARGO_TARGET_DIR              cargo's own, default capi/target
// Delete sanstun_capi.o to rebuild (sanstun.o is the generated binding wrapper).
// 0.1.1 is not on crates.io yet (2026-11-03): this is main as reviewed in LO_SANSTUN.md (mother repo).
const sanstun_ref = 'bc6482d53f20ae2b318a900decf3a8766be294d0'
const dir_mode = S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH
const exports = [
  'st_slot_size',
  'st_interface_new', 'st_interface_free', 'st_interface_public', 'st_interface_receive',
  'st_tunnel_new', 'st_tunnel_free', 'st_tunnel_id', 'st_tunnel_is_expired', 'st_tunnel_initiate',
  'st_tunnel_handle', 'st_tunnel_handle_timeout', 'st_tunnel_poll_timeout', 'st_tunnel_poll_event',
  'st_tunnel_encapsulate', 'st_tunnel_decapsulate',
  'st_tunnel_begin_encapsulate', 'st_pending_encrypt', 'st_tunnel_begin_decapsulate', 'st_pending_decrypt',
  'st_tunnel_commit_decapsulate', 'st_slot_drop'
]

function run (cmd, args) {
  const status = new Int32Array(3)
  exec(cmd, args, status)
  assert(status[0] === 0, `${cmd} ${args.join(' ')} failed: ${status[0]}`)
}

// The tarball's one top directory (sanstun-<ref>/) is renamed to deps/sanstun, which capi/Cargo.toml points at.
function fetch_source (ref) {
  if (isFile('deps/sanstun/Cargo.toml')) return
  mkdir('deps', dir_mode)
  assert(core.chdir('deps') === 0)
  fetch(`https://codeload.github.com/firezone/sanstun/tar.gz/${ref}`, 'sanstun.tar.gz')
  const top = untar(inflate(read_file('sanstun.tar.gz')))
  run('rm', ['-f', 'sanstun.tar.gz'])
  run('mv', [top.replace(/\/$/, ''), 'sanstun'])
  write_file('sanstun/.lo-ref', new TextEncoder().encode(`${ref}\n`))
  assert(core.chdir('../') === 0)
}

// Rust's std refers to the unwinder (_Unwind_*) even with panic = abort. On musl targets the toolchain ships its own
// libunwind.a (lib/rustlib/<triple>/lib/self-contained/): link it into the object, so a .so build needs no
// libgcc_s.so.1 at run time (glibc systems have libgcc_s anyway, so nothing is added there).
function rust_unwind_lib (cargo) {
  const toolchain = cargo.find(a => a.startsWith('+'))
  const rustc = ['rustc', ...(toolchain ? [toolchain] : [])].join(' ')
  const out = `rustc-info-${core.getpid()}.txt`
  const status = new Int32Array(3)
  exec('sh', ['-c', `${rustc} --print sysroot > ${out} && ${rustc} -vV >> ${out}`], status)
  if (status[0] !== 0) return ''
  const text = new TextDecoder().decode(read_file(out))
  run('rm', ['-f', out])
  const sysroot = text.split('\n')[0].trim()
  const host = (text.match(/^host: (.*)$/m) || [])[1]
  if (!host || !host.includes('musl')) return ''
  const lib = `${sysroot}/lib/rustlib/${host}/lib/self-contained/libunwind.a`
  return isFile(lib) ? lib : ''
}

// The archive carries Rust's std and sanstun's dependencies (ring's C/asm among them). Linking it into one
// relocatable object and keeping only the C ABI global means none of it can clash with lo's or V8's symbols.
async function build () {
  if (isFile('sanstun_capi.o')) return
  fetch_source(getenv('SANSTUN_REF') || sanstun_ref)
  const cargo = (getenv('CARGO') || 'cargo').split(' ')
  run(cargo[0], [...cargo.slice(1), 'build', '--release', '--manifest-path', 'capi/Cargo.toml',
    '-j', getenv('SANSTUN_JOBS') || '1'])
  const target_dir = getenv('CARGO_TARGET_DIR') || 'capi/target'
  const archive = `${target_dir}/release/libsanstun_capi.a`
  assert(isFile(archive), `${archive} not found`)
  const unwind = rust_unwind_lib(cargo)
  run('ld', ['-r', '-o', 'sanstun.all.o', '--whole-archive', archive, '--no-whole-archive', ...(unwind ? [unwind] : [])])
  run('objcopy', [...exports.map(s => `--keep-global-symbol=${s}`), 'sanstun.all.o', 'sanstun_capi.o'])
  run('rm', ['-f', 'sanstun.all.o'])
}

export { build }
