const api = {
  task_info: {
    parameters: ['u32', 'i32', 'pointer', 'pointer'],
    pointers: [, , 'task_info_t', 'mach_msg_type_number_t*'],
    result: 'i32'
  },
  task_self: {
    parameters: [],
    result: 'u32',
    name: 'mach_task_self'
  },
  get_executable_path: {
    parameters: ['pointer', 'u32array'],
    pointers: ['char*', 'uint32_t*'],
    result: 'i32',
    name: '_NSGetExecutablePath'
  }
}

const preamble = ''

const name = 'mach'

const constants = {
  TASK_BASIC_INFO_COUNT: 'i32',
  KERN_SUCCESS: 'i32',
  TASK_BASIC_INFO: 'i32'
}
const includes = ['mach/mach.h', 'mach-o/dyld.h']
const structs = ['task_basic_info', 'mach_msg_type_number_t']
const platform = ['mac']

export { name, api, constants, preamble, includes, structs, platform }
