declare class Timer<T extends OS> {
  constructor (
    loop: import('lib/loop.d.ts').Loop<T>,
    timeout: number,
    callback: Function,
    repeat?: number
  );

  close(): void;
}

export interface bindings<T extends OS = CurrentRuntimeGenerics['os']> {
  Timer: T extends 'win' ? never : Timer<T>;
}

