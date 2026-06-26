import { Bench } from 'lib/bench.js'

const { python } = lo.load('python')
const { assert } = lo

const {
  Py_SetProgramName,
  Py_InitializeEx,
  PyRun_SimpleString,
  PyUnicode_FromString,
  PyImport_Import,
  Py_DECREF,
  PyObject_GetAttrString,
  PyTuple_New,
  PyLong_FromLong,
  PyObject_CallObject,
  PyLong_AsLong,
  Py_XDECREF,
  Py_Finalize,
  PyTuple_SetItem,
} = python

const script = `
import sys
sys.path.insert(0, '')
`
Py_SetProgramName('test.py')
Py_InitializeEx(0)
assert(PyRun_SimpleString(script) === 0)
const name_ptr = assert(PyUnicode_FromString('foo'))
const module_ptr = assert(PyImport_Import(name_ptr))
Py_DECREF(name_ptr)
const func_ptr = assert(PyObject_GetAttrString(module_ptr, 'step'))
const tuple_ptr = assert(PyTuple_New(1))
PyTuple_SetItem(tuple_ptr, 0, assert(PyLong_FromLong(10)))

function increment () {
  const res_ptr = assert(PyObject_CallObject(func_ptr, tuple_ptr))
  const val = PyLong_AsLong(res_ptr)
  Py_DECREF(res_ptr)
  return val
}

const bench = new Bench()
const iter = 10
const runs = 7000000

for (let i = 0; i < 10; i++) {
  console.log(increment())
}

for (let i = 0; i < iter; i++) {
  bench.start('python.increment')
  for (let j = 0; j < runs; j++) assert(increment())
  bench.end(runs)
}

console.log(increment())

Py_DECREF(tuple_ptr)
Py_XDECREF(func_ptr)
Py_XDECREF(module_ptr)
Py_Finalize()
