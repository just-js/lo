const api = {
// dynamic loader
  mount: {
    parameters: ['string', 'string', 'string', 'u32', 'pointer'],
    result: 'i32',
  },
  umount: {
    parameters: ['string'],
    result: 'i32'
  },
  umount2: {
    parameters: ['string', 'i32'],
    result: 'i32'
  }
}

const includes = [
  'sys/mount.h'
]

const name = 'fsmount'
const constants = {
  // umount flags
  MNT_FORCE: 'i32', MNT_DETACH: 'i32', MNT_EXPIRE: 'i32', UMOUNT_NOFOLLOW: 'i32',
  // mount flags
  MS_DIRSYNC: 'u32', MS_LAZYTIME: 'u32', MS_MANDLOCK: 'u32', MS_NOATIME: 'u32',
  MS_NODEV: 'u32', MS_NODIRATIME: 'u32', MS_NOEXEC: 'u32', MS_NOSUID: 'u32',
  MS_RDONLY: 'u32', MS_REC: 'u32', MS_RELATIME: 'u32', MS_SILENT: 'u32',
  MS_STRICTATIME: 'u32', MS_SYNCHRONOUS: 'u32', MS_NOSYMFOLLOW: 'u32'
}

export { api, includes, name, constants }
