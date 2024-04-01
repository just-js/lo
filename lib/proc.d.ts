interface Proc {
  exec(program: string, args: []): Array[2];
}

declare var bindings: Proc & typeof globalThis;

export default bindings;

