const AD = '\u001b[0m' // ANSI Default
const A0 = '\u001b[30m' // ANSI Black
const AR = '\u001b[31m' // ANSI Red
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow
const AB = '\u001b[34m' // ANSI Blue
const AM = '\u001b[35m' // ANSI Magenta
const AC = '\u001b[36m' // ANSI Cyan
const AW = '\u001b[37m' // ANSI White

const colors = { AD, A0, AR, AG, AY, AB, AM, AC, AW }

const HOME = '\u001b[0;0H' // set cursor to 0,0
const CLS = '\u001b[2J' // clear screen
const EL = '\u001b[K' // erase line
const SAVECUR = '\u001b[s' // save cursor
const RESTCUR = '\u001b[u' // restore cursor
const HIDE = '\u001b[?25l' // hide cursor
const SHOW = '\u001b[?25h' // show cursor

const control = {
  home: () => HOME,
  move: (x = 0, y = 0) => `\u001b[${x};${y}H`,
  column: x => `\u001b[${x}G`,
  cls: () => CLS,
  eraseLine: () => EL,
  cursor: {
    hide: () => HIDE,
    show: () => SHOW,
    save: () => SAVECUR,
    restore: () => RESTCUR
  }
}

export { colors, control }
