const api = {
  Py_DecodeLocale: {
    parameters: ["pointer", "pointer"],
    pointers: ['const char*', 'size_t*'],
    rpointer: 'wchar_t*',
    result: "pointer",
  },

  Py_SetProgramName: {
    parameters: ["string"],
    casts: ["(const wchar_t *)"],
    result: "void",
  },

  Py_SetPath: {
    parameters: ["string"],
    casts: ["(const wchar_t *)"],
    result: "void",
  },

  Py_Initialize: {
    parameters: [],
    result: "void",
  },

  Py_InitializeEx: {
    parameters: ['i32'],
    result: "void",
  },

  Py_Finalize: {
    parameters: [],
    result: "void",
  },

  PyRun_SimpleString: {
    parameters: ["string"],
    result: "i32",
  },

  PyImport_ImportModule: {
    parameters: ["string"],
    rpointer: 'PyObject*',
    result: "pointer",
  },

  PyImport_Import: {
    parameters: ["pointer"],
    pointers: ['PyObject*'],
    rpointer: 'PyObject*',
    result: "pointer",
  },

  PyUnicode_FromString: {
    parameters: ["string"],
    rpointer: 'PyObject*',
    result: "pointer",
  },

  Py_DECREF: {
    parameters: ["pointer"],
    pointers: ['PyObject*'],
    result: "void"
  },

  PyObject_GetAttrString: {
    parameters: ["pointer", "string"],
    pointers: ['PyObject*'],
    result: "pointer",
    rpointer: 'PyObject*',
  },

  PyTuple_New: {
    parameters: ["u32"],
    result: "pointer",
    rpointer: 'PyObject*',
  },

  PyLong_FromLong: {
    parameters: ["u32"],
    result: "pointer",
    rpointer: 'PyObject*',
  },

  PyTuple_SetItem: {
    parameters: ["pointer", "u32", "pointer"],
    pointers: ["PyObject*", , "PyObject*"],
    result: "i32",
  },

  PyObject_CallObject: {
    parameters: ["pointer", "pointer"],
    pointers: ["PyObject*", "PyObject*"],
    result: "pointer",
    rpointer: 'PyObject*',
  },

  PyLong_AsLong: {
    parameters: ["pointer"],
    pointers: ["PyObject*"],
    result: "u32",
  },

  Py_XDECREF: {
    parameters: ["pointer"],
    pointers: ["PyObject*"],
    result: "void",
  }
}

const name = 'python'
//const obj = ['/lib/x86_64-linux-gnu/libpython3.10.a', '/lib/x86_64-linux-gnu/libexpat.a']
const includes = ['python3.10/Python.h']
const libs = ['python3.10']
const constants = {}

export { name, api, constants, includes, libs }
