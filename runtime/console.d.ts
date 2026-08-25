// Hand-written stand-in for the one global `one.ts` needs beyond plain ES5.
// Real `console` (lib.dom.d.ts/lib.webworker.d.ts) is a much richer
// interface; this only covers what's actually called. See PLAN.md task 68.
declare var console: {
  log(...args: any[]): void
}
