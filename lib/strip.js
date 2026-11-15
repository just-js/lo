'use strict';
// Single-pass, AST-free TypeScript type eraser (erase mode only, prototype).
// Records [start,end) ranges to blank out; newlines are preserved so every
// remaining JS character keeps its offset.

const NOT_VALUE = new Set(['return', 'typeof', 'void', 'delete', 'in', 'of', 'instanceof', 'new', 'throw', 'case',
  'do', 'else', 'yield', 'await', 'extends', 'if', 'while', 'for', 'switch', 'with', 'default', 'export', 'import',
  'var', 'let', 'const', 'function', 'class']);
const KEEP_STMT = new Set(['export', 'default', 'declare', 'abstract', 'async']);
const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'with']);
const BLOCK_PREV = new Set([')', '=>', 'else', 'do', 'try', 'finally']);
const JS_MOD = new Set(['static', 'async', 'get', 'set', 'accessor']);
const TS_MOD = new Set(['public', 'private', 'protected', 'readonly', 'override', 'abstract', 'declare']);
const DECLARE_NEXT = new Set(['function', 'const', 'let', 'var', 'class', 'namespace', 'module', 'global', 'enum',
  'interface', 'type', 'abstract', 'async']);
const DECLARE_BRACE = new Set(['class', 'namespace', 'module', 'global', 'enum', 'interface', 'abstract']);
const BINOP_WORDS = new Set(['as', 'satisfies', 'in', 'instanceof', 'of']);

const isIdStart = (c) => (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 36 || c === 95 || c > 127;
const isIdPart = (c) => isIdStart(c) || (c >= 48 && c <= 57);
const isDigit = (c) => c >= 48 && c <= 57;

function strip(src) {
  const s = src, n = s.length;
  let i = 0, nl = false, fails = 0;
  let ranges = [];
  const unsupported = [];
  const erase = (a, b) => { if (b > a) ranges.push(a, b); };
  const overrides = new Map();
  const eraseStmt = erase; // ASI guard (;) not implemented

  // ---------- low-level skipping ----------
  function ws() {
    nl = false;
    for (;;) {
      const c = s.charCodeAt(i);
      if (c === 10 || c === 13 || c === 0x2028 || c === 0x2029) { nl = true; i++; }
      else if (c === 32 || c === 9 || c === 11 || c === 12 || c === 0xa0 || c === 0xfeff) i++;
      else if (c === 47) {
        const d = s.charCodeAt(i + 1);
        if (d === 47) { i += 2; while (i < n) { const e = s.charCodeAt(i); if (e === 10 || e === 13) break; i++; } }
        else if (d === 42) {
          const e = s.indexOf('*/', i + 2), end = e < 0 ? n : e + 2;
          if (!nl) for (let k = i; k < end; k++) { const x = s.charCodeAt(k); if (x === 10 || x === 13) { nl = true; break; } }
          i = end;
        } else return;
      } else return;
    }
  }
  function readIdent() { const a = i; while (i < n && isIdPart(s.charCodeAt(i))) i++; return s.slice(a, i); }
  function isWord(w) { return s.startsWith(w, i) && !isIdPart(s.charCodeAt(i + w.length)); }
  function skipString(q) {
    i++;
    while (i < n) { const c = s.charCodeAt(i); if (c === 92) i += 2; else if (c === q) { i++; return; } else i++; }
  }
  function skipTemplateRaw() {
    i++;
    while (i < n) {
      const c = s.charCodeAt(i);
      if (c === 92) i += 2;
      else if (c === 96) { i++; return; }
      else if (c === 36 && s.charCodeAt(i + 1) === 123) { i += 2; skipGroup(1); }
      else i++;
    }
  }
  function skipGroup(depth = 0) {
    while (i < n) {
      const c = s.charCodeAt(i);
      if (c === 40 || c === 91 || c === 123) { depth++; i++; }
      else if (c === 41 || c === 93 || c === 125) { depth--; i++; if (depth <= 0) return; }
      else if (c === 34 || c === 39) skipString(c);
      else if (c === 96) skipTemplateRaw();
      else if (c === 47) {
        const d = s.charCodeAt(i + 1);
        if (d === 47) { while (i < n && s.charCodeAt(i) !== 10) i++; }
        else if (d === 42) { const e = s.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; }
        else i++;
      } else i++;
    }
  }
  function skipAngles() { // at '<'; loose, for declared type params / type args
    let depth = 0;
    while (i < n) {
      const c = s.charCodeAt(i);
      if (c === 60) { depth++; i++; }
      else if (c === 62) { if (s.charCodeAt(i - 1) === 61) i++; else { depth--; i++; if (depth === 0) return true; } }
      else if (c === 34 || c === 39) skipString(c);
      else if (c === 96) skipTemplateRaw();
      else if (c === 40 || c === 91 || c === 123) skipGroup();
      else if (c === 59) return false;
      else if (c === 47 && s.charCodeAt(i + 1) === 47) { while (i < n && s.charCodeAt(i) !== 10) i++; }
      else if (c === 47 && s.charCodeAt(i + 1) === 42) { const e = s.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; }
      else i++;
    }
    return false;
  }
  function skipNumber() {
    const hex = s.charCodeAt(i) === 48 && (s.charCodeAt(i + 1) | 32) === 120;
    if (s.charCodeAt(i) === 46) i++;
    while (i < n) {
      const c = s.charCodeAt(i);
      if (isDigit(c) || c === 95 || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) {
        i++;
        if (!hex && (c === 101 || c === 69)) { const d = s.charCodeAt(i); if (d === 43 || d === 45) i++; }
      } else if (c === 46 && (isDigit(s.charCodeAt(i + 1)) || !(isIdStart(s.charCodeAt(i + 1)) || s.charCodeAt(i + 1) === 46))) i++;
      else break;
    }
  }

  // ---------- type skipping (char level, returns success) ----------
  function skipType() {
    if (!skipUnion()) return false;
    const sv = i; ws();
    if (isWord('extends')) {
      i += 7;
      if (!skipUnion()) return false;
      ws(); if (s.charCodeAt(i) !== 63) return false; i++;
      if (!skipType()) return false;
      ws(); if (s.charCodeAt(i) !== 58) return false; i++;
      return skipType();
    }
    i = sv; return true;
  }
  function skipUnion() {
    ws();
    let c = s.charCodeAt(i);
    if (c === 124 || c === 38) i++;
    for (;;) {
      if (!skipPostfix()) return false;
      const sv = i; ws(); c = s.charCodeAt(i);
      if ((c === 124 || c === 38) && s.charCodeAt(i + 1) !== c && s.charCodeAt(i + 1) !== 61) { i++; continue; }
      i = sv; return true;
    }
  }
  function funcTail() { // after params group of a function/constructor type
    ws();
    if (s.charCodeAt(i) === 61 && s.charCodeAt(i + 1) === 62) { i += 2; return skipType(); }
    return false;
  }
  function isFunctionTypeStart() { // at '(' : mirrors TS's isStartOfFunctionTypeOrConstructorType
    const sv = i; i++; ws();
    let r = false; const c = s.charCodeAt(i);
    const after = () => { ws(); const d = s.charCodeAt(i); if (d === 58 || d === 44 || d === 63 || d === 61) return true; if (d === 41) { i++; ws(); return s.charCodeAt(i) === 61 && s.charCodeAt(i + 1) === 62; } return false; };
    if (c === 41) r = true;
    else if (c === 46) r = true;
    else if (isIdStart(c)) { readIdent(); r = after(); }
    else if (c === 123 || c === 91) { skipGroup(); r = after(); }
    i = sv; return r;
  }
  function skipPostfix() {
    ws();
    let c = s.charCodeAt(i);
    if (!(c >= 0)) return false;
    if (isIdStart(c)) {
      const w = readIdent();
      if (w === 'keyof' || w === 'readonly' || w === 'unique' || w === 'infer') return skipPostfix();
      if (w === 'asserts') {
        const sv = i; ws();
        if (isIdStart(s.charCodeAt(i)) && !isWord('is')) return skipPostfix();
        i = sv;
      } else if (w === 'typeof') {
        ws();
        if (isWord('import')) { readIdent(); ws(); skipGroup(); }
        else { readIdent(); while (s.charCodeAt(i) === 46) { i++; readIdent(); } }
        if (s.charCodeAt(i) === 60) { if (!skipAngles()) return false; }
      } else if (w === 'new' || (w === 'abstract' && (ws(), isWord('new')))) {
        if (w === 'abstract') { readIdent(); }
        ws();
        if (s.charCodeAt(i) === 60) { if (!skipAngles()) return false; ws(); }
        if (s.charCodeAt(i) !== 40) return false;
        skipGroup();
        return funcTail();
      } else if (w === 'import') {
        ws(); if (s.charCodeAt(i) === 40) skipGroup();
        while (s.charCodeAt(i) === 46) { i++; readIdent(); }
        if (s.charCodeAt(i) === 60) { if (!skipAngles()) return false; }
      } else {
        while (s.charCodeAt(i) === 46 && isIdStart(s.charCodeAt(i + 1))) { i++; readIdent(); }
        if (s.charCodeAt(i) === 60) { if (!skipAngles()) return false; }
      }
    } else if (c === 40) {
      const isFn = isFunctionTypeStart();
      skipGroup();
      if (isFn) { const sv = i; ws(); if (s.charCodeAt(i) === 61 && s.charCodeAt(i + 1) === 62) { i += 2; return skipType(); } i = sv; }
    } else if (c === 60) {
      if (!skipAngles()) return false; ws();
      if (s.charCodeAt(i) !== 40) return false;
      skipGroup(); return funcTail();
    } else if (c === 123 || c === 91) skipGroup();
    else if (c === 34 || c === 39) skipString(c);
    else if (c === 96) skipTemplateRaw();
    else if (c === 45) { i++; skipNumber(); }
    else if (isDigit(c)) skipNumber();
    else return false;
    for (;;) {
      const sv = i; ws();
      if (!nl && s.charCodeAt(i) === 91) { skipGroup(); continue; }
      if (!nl && isWord('is')) { i += 2; return skipType(); }
      i = sv; return true;
    }
  }
  // annotation after ':' at s[i-1]; erases [colon, end). returns success
  function annotate(colon) {
    const sv = i;
    if (skipType()) { erase(colon, i); return true; }
    fails++; i = sv; return false;
  }

  // ---------- expression-level generics ----------
  function skipTypeArgsStrict() {
    i++;
    for (;;) {
      if (!skipType()) return false;
      ws();
      const c = s.charCodeAt(i);
      if (c === 44) { i++; ws(); if (s.charCodeAt(i) === 62) { i++; return true; } continue; }
      if (c === 62) { i++; return true; }
      return false;
    }
  }
  function canFollowTypeArgs() {
    const sv = i; ws();
    const c = s.charCodeAt(i), wasNl = nl;
    let r;
    if (c === 40 || c === 96) r = true;
    else if (c === 60 || c === 62 || c === 43 || c === 45) r = false;
    else if (wasNl) r = true;
    else if (isIdStart(c)) { const a = i; const w = readIdent(); i = a; r = BINOP_WORDS.has(w); }
    else if (isDigit(c) || c === 34 || c === 39 || c === 33 || c === 126 || c === 91 || c === 123) r = false;
    else r = true;
    i = sv; return r;
  }

  // ---------- statements ----------
  function peekWord() { const sv = i; ws(); let w = ''; if (isIdStart(s.charCodeAt(i))) w = readIdent(); const end = i; i = sv; return w; }
  function optSemi() { const sv = i; ws(); if (s.charCodeAt(i) === 59) i++; else i = sv; }
  function skipModuleClause() {
    let sawBrace = false;
    for (;;) {
      ws(); const c = s.charCodeAt(i);
      if (i >= n) return;
      if (c === 123) { skipGroup(); sawBrace = true; ws(); if (!isWord('from')) return; }
      else if (c === 42 || c === 44) i++;
      else if (c === 34 || c === 39) { skipString(c); return; }
      else if (isIdStart(c)) readIdent();
      else return;
    }
  }
  function handleInterface(start) { // i after 'interface'
    ws(); readIdent(); ws();
    if (s.charCodeAt(i) === 60) skipAngles();
    for (;;) {
      ws(); if (i >= n) break;
      const c = s.charCodeAt(i);
      if (c === 123) { skipGroup(); break; }
      if (c === 60) skipAngles(); else i++;
    }
    eraseStmt(start, i);
  }
  function handleTypeAlias(start) { // i after 'type'
    const sl = ranges.length;
    ws(); readIdent(); ws();
    if (s.charCodeAt(i) === 60) skipAngles();
    ws();
    if (s.charCodeAt(i) === 61) {
      i++;
      if (!skipType()) { fails++; while (i < n && s.charCodeAt(i) !== 59) i++; }
    }
    optSemi();
    ranges.length = sl;
    eraseStmt(start, i);
  }
  function handleDeclare(start, kind) { // i after 'declare'
    ws();
    const sl = ranges.length;
    const brace = DECLARE_BRACE.has(kind);
    let prevEndChar = false;
    for (;;) {
      ws();
      if (i >= n) break;
      const c = s.charCodeAt(i);
      if (nl && prevEndChar && isIdStart(c) && !brace) break;
      if (c === 59) { i++; break; }
      if (c === 123 || c === 40 || c === 91) {
        skipGroup(); prevEndChar = true;
        if (c === 123 && brace) break;
      } else if (isIdStart(c)) { readIdent(); prevEndChar = true; }
      else if (c === 34 || c === 39) { skipString(c); prevEndChar = true; }
      else { i++; prevEndChar = c === 62 || c === 41; }
    }
    ranges.length = sl;
    eraseStmt(start, i);
  }

  function handleClass() { // i after 'class'
    ws();
    if (isIdStart(s.charCodeAt(i))) { const sv = i; const w = readIdent(); if (w === 'extends' || w === 'implements') i = sv; }
    ws();
    if (s.charCodeAt(i) === 60) { const a = i; skipAngles(); erase(a, i); }
    for (;;) {
      ws(); if (i >= n) return;
      const c = s.charCodeAt(i);
      if (c === 123) break;
      if (isIdStart(c)) {
        const sv = i; const w = readIdent();
        if (w === 'implements') {
          for (;;) { ws(); if (i >= n || s.charCodeAt(i) === 123) break; if (s.charCodeAt(i) === 60) skipAngles(); else i++; }
          erase(sv, i);
        }
      } else if (c === 60) { const a = i; skipAngles(); erase(a, i); }
      else if (c === 40) skipGroup();
      else i++;
    }
    i++; // '{'
    scanClassBody();
  }

  function scanClassBody() {
    for (;;) {
      ws();
      if (i >= n) return;
      let c = s.charCodeAt(i);
      if (c === 125) { i++; return; }
      if (c === 59) { i++; continue; }
      const mStart = i, sl = ranges.length;
      let eraseWhole = false;
      while (s.charCodeAt(i) === 64) {
        i++; readIdent(); while (s.charCodeAt(i) === 46) { i++; readIdent(); }
        ws(); if (s.charCodeAt(i) === 40) { i++; scan('paren'); } ws();
      }
      let staticBlock = false;
      for (;;) {
        ws(); c = s.charCodeAt(i);
        if (c === 42) { i++; continue; }
        if (!isIdStart(c)) break;
        const save = i, w = readIdent();
        if (JS_MOD.has(w) || TS_MOD.has(w)) {
          const after = i; ws(); const d = s.charCodeAt(i), wasNl = nl; i = after;
          if (d === 40 || d === 61 || d === 59 || d === 58 || d === 63 || d === 33 || d === 125 || d === 60 || d === 44) { i = save; break; }
          if (w === 'static' && d === 123) { ws(); i++; scan('block'); staticBlock = true; break; }
          if (TS_MOD.has(w)) { erase(save, i); if (w === 'abstract' || w === 'declare') eraseWhole = true; }
          continue;
        }
        i = save; break;
      }
      if (staticBlock) continue;
      ws(); c = s.charCodeAt(i);
      let indexSig = false;
      if (c === 91) {
        const a = i;
        indexSig = /^\[\s*[A-Za-z_$][\w$]*\s*:/.test(s.slice(a, a + 80));
        if (indexSig) { skipGroup(); } else { i++; scan('bracket'); }
      } else if (c === 34 || c === 39) skipString(c);
      else if (isDigit(c)) skipNumber();
      else if (c === 35) { i++; readIdent(); }
      else if (isIdStart(c)) readIdent();
      else { i++; continue; }
      ws(); c = s.charCodeAt(i);
      if (indexSig) {
        if (c === 58) { i++; skipType(); }
        optSemi();
        ranges.length = sl; erase(mStart, i); continue;
      }
      if ((c === 63 || c === 33)) { erase(i, i + 1); i++; ws(); c = s.charCodeAt(i); }
      if (c === 60) { const a = i; skipAngles(); erase(a, i); ws(); c = s.charCodeAt(i); }
      if (c === 40) {
        i++; scan('paren'); ws();
        if (s.charCodeAt(i) === 58) { const a = i; i++; annotate(a); ws(); }
        if (s.charCodeAt(i) === 123 && !eraseWhole) { i++; scan('block'); }
        else { optSemi(); ranges.length = sl; erase(mStart, i); }
        continue;
      }
      if (c === 58) { const a = i; i++; annotate(a); ws(); c = s.charCodeAt(i); }
      if (eraseWhole) { if (c === 61) { i++; scan('init'); } else optSemi(); ranges.length = sl; erase(mStart, i); continue; }
      if (c === 61 && s.charCodeAt(i + 1) !== 61) { i++; scan('init'); }
    }
  }

  function objectMember() { // at member start in object literal/pattern; consumes through key (and method head/body)
    for (;;) {
      ws(); const c = s.charCodeAt(i);
      if (c === 42) { i++; continue; }
      if (isIdStart(c)) {
        const sv = i, w = readIdent();
        if (w === 'get' || w === 'set' || w === 'async') {
          const a = i; ws(); const d = s.charCodeAt(i); i = a;
          if (!(d === 40 || d === 58 || d === 44 || d === 125 || d === 61 || d === 60 || d === 59 || !(d >= 0))) continue;
        }
      } else if (c === 34 || c === 39) skipString(c);
      else if (isDigit(c)) skipNumber();
      else if (c === 91) { i++; scan('bracket'); }
      else return false;
      break;
    }
    const sv = i; ws();
    let c = s.charCodeAt(i);
    if (c === 60) { const a = i; if (skipAngles()) { erase(a, i); ws(); c = s.charCodeAt(i); } else { i = a; return true; } }
    if (c === 40) {
      i++; scan('paren'); ws();
      if (s.charCodeAt(i) === 58) { const a = i; i++; annotate(a); ws(); }
      if (s.charCodeAt(i) === 123) { i++; scan('block'); }
      return true;
    }
    i = sv; return true;
  }

  // ---------- main scanner ----------
  function scan(kind) {
    let ternary = 0, varDecl = false, lastColonTernary = false;
    let stmtStart = kind === 'top' || kind === 'block', stmtFirst = -1;
    let memberStart = kind === 'object', specBrace = false, specStart = true;
    let prevEnd = false, asiEnd = false, pt = '';
    let lastN = -1;

    for (;;) {
      ws();
      if (i >= n) return;
      if (i === lastN) i++; lastN = i; // progress guard
      const c = s.charCodeAt(i);
      if (varDecl && nl && asiEnd && isIdStart(c) && kind !== 'paren') { const a = i; if (!BINOP_WORDS.has(readIdent())) varDecl = false; i = a; }

      if (kind === 'init') {
        if (c === 59) { i++; return; }
        if (c === 125) return;
        if (nl && asiEnd && (isIdStart(c) || c === 34 || c === 39 || c === 35 || c === 64)) {
          let ok = true;
          if (isIdStart(c)) { const a = i; ok = !BINOP_WORDS.has(readIdent()); i = a; }
          if (ok) return;
        }
      }
      if (kind === 'object' && memberStart) {
        memberStart = false;
        if (c !== 125 && c !== 46 && c !== 44) { objectMember(); prevEnd = true; asiEnd = true; pt = 'key'; continue; }
      }
      if (kind === 'spec' && specStart) {
        specStart = false;
        if (isWord('type')) {
          const a = i; i += 4; const sv = i; ws();
          const d = s.charCodeAt(i);
          if (isIdStart(d) && !(isWord('as') && false)) {
            readIdent(); ws();
            if (isWord('as')) { readIdent(); ws(); if (isIdStart(s.charCodeAt(i))) readIdent(); }
            ws(); if (s.charCodeAt(i) === 44) i++;
            erase(a, i); specStart = true; continue;
          }
          i = a;
        }
      }
      if (stmtStart && stmtFirst < 0) stmtFirst = i;

      // closers
      if (c === 41 || c === 93 || c === 125) {
        if ((c === 41 && kind === 'paren') || (c === 93 && kind === 'bracket') ||
            (c === 125 && (kind === 'block' || kind === 'object' || kind === 'spec' || kind === 'tmpl'))) { i++; return; }
        if (kind === 'init' || kind === 'top') { i++; continue; }
        i++; prevEnd = c !== 125; asiEnd = true; pt = String.fromCharCode(c); continue;
      }

      if (isIdStart(c) || c === 35) {
        const tokStart = i;
        if (c === 35) i++;
        const w = readIdent();
        if (pt === '.' || pt === '?.') { prevEnd = true; asiEnd = true; pt = w; stmtStart = false; continue; }
        const atStmt = stmtStart || (nl && asiEnd && (kind === 'top' || kind === 'block'));
        if (atStmt && !stmtStart) { stmtFirst = tokStart; stmtStart = true; }

        if ((w === 'as' || w === 'satisfies') && prevEnd && !nl && kind !== 'spec') {
          const sv = i; if (skipType()) erase(tokStart, i); else { fails++; i = sv; }
          prevEnd = true; asiEnd = true; pt = 'T'; continue;
        }
        let handled = false;
        if (atStmt && (kind === 'top' || kind === 'block')) {
          const nw = (() => { const sv = i; ws(); const d = s.charCodeAt(i), ln = nl; const r = isIdStart(d) && !ln ? readIdent() : ''; i = sv; return r; })();
          if (w === 'interface' && nw) { handleInterface(stmtFirst >= 0 && stmtFirst <= tokStart && pt === 'export' ? stmtFirst : tokStart); handled = true; }
          else if (w === 'type' && nw && nw !== 'from' || (w === 'type' && nw === 'from' && false)) { handleTypeAlias(pt === 'export' || pt === 'default' ? stmtFirst : tokStart); handled = true; }
          else if (w === 'declare' && DECLARE_NEXT.has(nw)) { handleDeclare(stmtFirst >= 0 ? stmtFirst : tokStart, nw); handled = true; }
          else if (w === 'abstract' && nw === 'class') { erase(tokStart, i); handled = true; stmtStart = true; pt = 'abstract'; prevEnd = false; asiEnd = false; continue; }
          else if (w === 'enum' && nw) { unsupported.push('enum'); }
          else if ((w === 'namespace' || w === 'module') && nw) { unsupported.push(w); }
          else if (w === 'export') {
            const sv = i; const p = peekWord();
            if (p === 'type') {
              ws(); readIdent(); const sv2 = i; ws(); const d = s.charCodeAt(i);
              if (d === 123 || d === 42) { skipModuleClause(); optSemi(); eraseStmt(tokStart, i); handled = true; }
              else if (isIdStart(d)) { handleTypeAlias(tokStart); handled = true; }
              else i = sv;
            } else if (p === 'interface') { ws(); readIdent(); handleInterface(tokStart); handled = true; }
            else if (p === 'declare') {
              ws(); readIdent(); const nw2 = peekWord();
              if (DECLARE_NEXT.has(nw2)) { handleDeclare(tokStart, nw2); handled = true; } else i = sv;
            } else if (p === 'enum' || p === 'namespace' || p === 'module') { /* flagged when reached */ }
            else { const sv3 = i; ws(); if (s.charCodeAt(i) === 123) specBrace = true; i = sv3; }
          } else if (w === 'import') {
            const sv = i; ws(); const d = s.charCodeAt(i);
            if (isWord('type')) {
              const a = i; readIdent(); ws(); const e = s.charCodeAt(i);
              let isType = false;
              if (e === 123 || e === 42) isType = true;
              else if (isIdStart(e)) { const b = i; const x = readIdent(); if (x !== 'from') isType = true; else { ws(); isType = !(s.charCodeAt(i) === 34 || s.charCodeAt(i) === 39); } i = b; }
              if (isType) { skipModuleClause(); optSemi(); eraseStmt(tokStart, i); handled = true; }
              else i = sv;
            } else if (d !== 40 && d !== 46 && d !== 34 && d !== 39) { specBrace = true; i = sv; }
            else i = sv;
          }
        }
        if (handled) { stmtStart = true; stmtFirst = -1; prevEnd = false; asiEnd = false; pt = ';'; continue; }

        if (w === 'function') {
          const fStart = stmtStart && stmtFirst >= 0 ? stmtFirst : tokStart;
          ws(); if (s.charCodeAt(i) === 42) { i++; ws(); }
          if (isIdStart(s.charCodeAt(i))) { readIdent(); ws(); }
          if (s.charCodeAt(i) === 60) { const a = i; skipAngles(); erase(a, i); ws(); }
          if (s.charCodeAt(i) === 40) {
            const sl = ranges.length;
            i++; scan('paren'); ws();
            if (s.charCodeAt(i) === 58) { const a = i; i++; annotate(a); ws(); }
            if (s.charCodeAt(i) === 123) { i++; scan('block'); }
            else { optSemi(); ranges.length = sl; eraseStmt(fStart, i); stmtStart = true; stmtFirst = -1; pt = ';'; prevEnd = false; asiEnd = false; continue; }
          }
          if (atStmt) { stmtStart = true; stmtFirst = -1; prevEnd = false; pt = '}'; } else { stmtStart = false; prevEnd = true; pt = '}'; }
          asiEnd = true; continue;
        }
        if (w === 'class') {
          handleClass();
          if (atStmt) { stmtStart = true; stmtFirst = -1; prevEnd = false; } else { stmtStart = false; prevEnd = true; }
          asiEnd = true; pt = '}'; continue;
        }
        if (w === 'let' || w === 'const' || w === 'var') { varDecl = true; if (w === 'const' && peekWord() === 'enum') unsupported.push('const enum'); }
        else if (w === 'this' && kind === 'paren') {
          const sv = i; ws();
          if (s.charCodeAt(i) === 58) { i++; if (skipType()) { ws(); if (s.charCodeAt(i) === 44) i++; erase(tokStart, i); pt = ','; prevEnd = false; continue; } i = sv; }
          else i = sv;
        } else if (kind === 'paren' && (w === 'public' || w === 'private' || w === 'protected' || w === 'readonly' || w === 'override') && (pt === '(' || pt === ',')) {
          const sv = i; ws(); const d = s.charCodeAt(i); i = sv;
          if (isIdStart(d) || d === 123 || d === 91) unsupported.push('param-property');
        }
        const nv = !NOT_VALUE.has(w);
        prevEnd = nv; asiEnd = nv; pt = w;
        if (!(stmtStart && KEEP_STMT.has(w))) { stmtStart = false; }
        if (kind === 'spec') specStart = false;
        continue;
      }

      if (isDigit(c) || (c === 46 && isDigit(s.charCodeAt(i + 1)))) { skipNumber(); prevEnd = true; asiEnd = true; pt = 'lit'; stmtStart = false; continue; }
      if (c === 34 || c === 39) { skipString(c); specBrace = false; prevEnd = true; asiEnd = true; pt = 'lit'; stmtStart = false; continue; }
      if (c === 96) {
        i++;
        while (i < n) {
          const d = s.charCodeAt(i);
          if (d === 92) i += 2;
          else if (d === 96) { i++; break; }
          else if (d === 36 && s.charCodeAt(i + 1) === 123) { i += 2; scan('tmpl'); }
          else i++;
        }
        prevEnd = true; asiEnd = true; pt = 'lit'; stmtStart = false; continue;
      }
      const wasStmt = stmtStart;
      stmtStart = stmtStart && (c === 64) ? true : false;

      switch (c) {
        case 47: { // / regex or division
          const d = s.charCodeAt(i + 1);
          if (!prevEnd) { // regex
            i++;
            while (i < n) {
              const e = s.charCodeAt(i);
              if (e === 92) i += 2;
              else if (e === 91) { i++; while (i < n && s.charCodeAt(i) !== 93) { if (s.charCodeAt(i) === 92) i++; i++; } i++; }
              else if (e === 47) { i++; break; }
              else if (e === 10) break;
              else i++;
            }
            while (i < n && isIdPart(s.charCodeAt(i))) i++;
            prevEnd = true; asiEnd = true; pt = 'lit';
          } else { i += d === 61 ? 2 : 1; prevEnd = false; asiEnd = false; pt = '/'; }
          continue;
        }
        case 40: { // (
          const ctl = CONTROL.has(pt);
          i++; scan('paren');
          const closeP = i - 1;
          const sv = i; ws();
          if (!ctl && s.charCodeAt(i) === 58) {
            const colon = i; i++;
            if (skipType()) {
              const te = i; ws();
              if (s.charCodeAt(i) === 61 && s.charCodeAt(i + 1) === 62) {
                if (s.indexOf('\n', closeP) >= 0 && s.indexOf('\n', closeP) < te) { erase(closeP, te); overrides.set(te - 1, ')'); }
                else erase(colon, te);
              } else i = sv;
            } else i = sv;
          } else i = sv;
          prevEnd = !ctl; asiEnd = !ctl; pt = ')';
          continue;
        }
        case 91: i++; scan('bracket'); prevEnd = true; asiEnd = true; pt = ']'; continue;
        case 123: {
          let block = (wasStmt && pt !== 'default') || BLOCK_PREV.has(pt) || (pt === ':' && !lastColonTernary && (kind === 'block' || kind === 'top'));
          if (kind === 'object' && memberStart) block = false;
          i++;
          if (specBrace) { specBrace = false; scan('spec'); prevEnd = false; asiEnd = true; pt = '}'; continue; }
          if (block) { scan('block'); stmtStart = true; stmtFirst = -1; prevEnd = false; asiEnd = true; pt = '}'; }
          else { scan('object'); prevEnd = true; asiEnd = true; pt = '}'; }
          continue;
        }
        case 60: { // <
          if (!prevEnd || pt === 'async') {
            const a = i;
            if (skipAngles()) { ws(); if (s.charCodeAt(i) === 40) { if (s.indexOf('\n', a) >= 0 && s.indexOf('\n', a) < i) { erase(a, i + 1); overrides.set(a, '('); } else erase(a, i); continue; } }
            i = a + 1; prevEnd = false; asiEnd = false; pt = '<'; continue;
          }
          if (prevEnd && isIdStart(s.charCodeAt(i - 1)) || pt === 'T') {
            const a = i;
            if (skipTypeArgsStrict() && canFollowTypeArgs()) { erase(a, i); continue; }
            i = a;
          }
          i += opLen(c); prevEnd = false; asiEnd = false; pt = '<'; continue;
        }
        case 33: { // !
          if (prevEnd && !nl && s.charCodeAt(i + 1) !== 61) { erase(i, i + 1); i++; continue; }
          i += opLen(c); prevEnd = false; asiEnd = false; pt = '!'; continue;
        }
        case 63: { // ?
          const d = s.charCodeAt(i + 1);
          if (d === 46 && !isDigit(s.charCodeAt(i + 2))) { i += 2; prevEnd = false; asiEnd = false; pt = '?.'; continue; }
          if (d === 63) { i += s.charCodeAt(i + 2) === 61 ? 3 : 2; prevEnd = false; asiEnd = false; pt = '??'; continue; }
          const sv = i; i++; ws(); const e = s.charCodeAt(i);
          if (e === 58 || e === 44 || e === 41 || e === 61) { erase(sv, sv + 1); }
          else { i = sv + 1; ternary++; }
          prevEnd = false; asiEnd = false; pt = '?'; continue;
        }
        case 58: { // :
          const colon = i; i++;
          if (ternary > 0) { ternary--; lastColonTernary = true; prevEnd = false; asiEnd = false; pt = ':'; continue; }
          lastColonTernary = false;
          if (kind === 'paren' || (varDecl && (kind === 'block' || kind === 'top' || kind === 'tmpl'))) {
            annotate(colon); prevEnd = true; asiEnd = true; pt = 'T'; continue;
          }
          prevEnd = false; asiEnd = false; pt = ':'; continue;
        }
        case 59: i++; stmtStart = true; stmtFirst = -1; varDecl = false; ternary = 0; prevEnd = false; asiEnd = false; pt = ';'; continue;
        case 44: i++; if (kind === 'object') memberStart = true; if (kind === 'spec') specStart = true; if (kind === 'paren') ternary = 0; prevEnd = false; asiEnd = false; pt = ','; continue;
        default: {
          const len = opLen(c);
          if (c === 43 || c === 45) { if (len === 2 && s.charCodeAt(i) === s.charCodeAt(i + 1)) { i += 2; pt = '++'; continue; } }
          const op = s.substr(i, len); i += len;
          prevEnd = false; asiEnd = false; pt = op; continue;
        }
      }
    }
  }

  function opLen(c) {
    const c1 = s.charCodeAt(i + 1), c2 = s.charCodeAt(i + 2);
    switch (c) {
      case 61: if (c1 === 62) return 2; if (c1 === 61) return c2 === 61 ? 3 : 2; return 1;
      case 33: if (c1 === 61) return c2 === 61 ? 3 : 2; return 1;
      case 60: if (c1 === 60) return c2 === 61 ? 3 : 2; if (c1 === 61) return 2; return 1;
      case 62: if (c1 === 62) { if (c2 === 62) return s.charCodeAt(i + 3) === 61 ? 4 : 3; return c2 === 61 ? 3 : 2; } if (c1 === 61) return 2; return 1;
      case 38: case 124: if (c1 === c) return c2 === 61 ? 3 : 2; if (c1 === 61) return 2; return 1;
      case 43: case 45: if (c1 === c || c1 === 61) return 2; return 1;
      case 42: if (c1 === 42) return c2 === 61 ? 3 : 2; if (c1 === 61) return 2; return 1;
      case 37: case 94: return c1 === 61 ? 2 : 1;
      case 46: return c1 === 46 && c2 === 46 ? 3 : 1;
      default: return 1;
    }
  }

  if (s.charCodeAt(0) === 35 && s.charCodeAt(1) === 33) { while (i < n && s.charCodeAt(i) !== 10) i++; }
  scan('top');

  // ---------- assemble output ----------
  if (ranges.length === 0) return { code: src, unsupported, fails };
  let sorted = true;
  for (let k = 2; k < ranges.length; k += 2) if (ranges[k] < ranges[k - 1]) { sorted = false; break; }
  if (!sorted) {
    const pairs = []; for (let k = 0; k < ranges.length; k += 2) pairs.push([ranges[k], ranges[k + 1]]);
    pairs.sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const p of pairs) { const l = merged[merged.length - 1]; if (l && p[0] <= l[1]) l[1] = Math.max(l[1], p[1]); else merged.push(p); }
    ranges = []; for (const p of merged) ranges.push(p[0], p[1]);
  }
  const parts = [];
  let last = 0;
  for (let k = 0; k < ranges.length; k += 2) {
    const a = ranges[k], b = ranges[k + 1];
    parts.push(s.slice(last, a));
    const seg = s.slice(a, b);
    let blank = seg.indexOf('\n') < 0 && seg.indexOf('\r') < 0 ? ' '.repeat(b - a) : seg.replace(/[^\r\n]/g, ' ');
    parts.push(blank);
    last = b;
  }
  parts.push(s.slice(last));
  let code = parts.join('');
  if (overrides.size) { const arr = code.split(''); for (const [p, ch] of overrides) arr[p] = ch; code = arr.join(''); }
  return { code, unsupported, fails };
}

export { strip }
