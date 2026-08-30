#!/usr/bin/env node
// flamegraph.js <perf-script-output> <out.svg> [--fold-only]
//
// Folds `perf script` stack samples and renders a standalone, self-
// contained SVG flamegraph (Brendan Gregg's flamegraph.pl format,
// reimplemented in JS rather than fetched, since this sandbox has no
// FlameGraph checkout and the tool is ~150 lines of straightforward
// string processing - no reason to add a Perl dependency for it).
//
// Usage (see tools/lo-profile.sh, which drives this end to end):
//   perf script -i perf.data > perf-script.txt
//   node tools/flamegraph.js perf-script.txt out.svg
//   node tools/flamegraph.js perf-script.txt out.folded --fold-only
//
// Companion doc: repos/lo/doc/PROFILING.md.

import { readFileSync, writeFileSync } from 'node:fs'

const [, , inPath, outPath, mode] = process.argv
if (!inPath || !outPath) {
  console.error('usage: flamegraph.js <perf-script-output> <out.svg|out.folded> [--fold-only]')
  process.exit(1)
}

// --- 1. Parse `perf script` output into folded stacks -----------------
//
// Each sample is a header line (command/pid/time/event, ignored) followed
// by indented frames from leaf (first) to root (last), then a blank line.
// A frame line looks like:
//   <hex addr>  <symbol name, possibly containing "(...)" itself,
//                e.g. C++ parameter lists>+0x<offset> (<module path>)
// The reliable anchors are the trailing " (<module>)" (module paths don't
// contain parens) and, just before it, an optional "+0x<hex>" offset -
// everything else in between is the symbol, parens and all.

function parseFrame (line) {
  let rest = line.trim().replace(/^[0-9a-fA-F]+\s+/, '')
  const moduleMatch = rest.match(/\s\(([^()]*)\)\s*$/)
  const module = moduleMatch ? moduleMatch[1] : '?'
  if (moduleMatch) rest = rest.slice(0, moduleMatch.index)
  rest = rest.replace(/\+0x[0-9a-fA-F]+$/, '').trim()
  if (!rest || /^0x?[0-9a-fA-F]+$/.test(rest)) {
    rest = `[unknown in ${module.split('/').pop()}]`
  }
  return rest
}

const raw = readFileSync(inPath, 'utf8')
const folded = new Map() // "root;...;leaf" -> count

let block = []
for (const line of raw.split('\n')) {
  if (line.trim() === '') {
    if (block.length > 1) {
      // block[0] is the sample header; block[1..] are leaf-to-root frames.
      const frames = block.slice(1).map(parseFrame).reverse() // root..leaf
      const key = frames.join(';')
      folded.set(key, (folded.get(key) || 0) + 1)
    }
    block = []
    continue
  }
  block.push(line)
}
if (block.length > 1) {
  const frames = block.slice(1).map(parseFrame).reverse()
  const key = frames.join(';')
  folded.set(key, (folded.get(key) || 0) + 1)
}

if (mode === '--fold-only') {
  const lines = [...folded.entries()].map(([k, v]) => `${k} ${v}`)
  writeFileSync(outPath, lines.join('\n') + '\n')
  console.error(`wrote ${lines.length} folded stacks to ${outPath}`)
  process.exit(0)
}

// --- 2. Build a call tree from the folded stacks -----------------------

function newNode (name) {
  return { name, value: 0, children: new Map() }
}

const root = newNode('root')
for (const [key, count] of folded) {
  let node = root
  node.value += count
  if (key === '') continue
  for (const name of key.split(';')) {
    if (!node.children.has(name)) node.children.set(name, newNode(name))
    node = node.children.get(name)
    node.value += count
  }
}

// --- 3. Render as an SVG flamegraph -------------------------------------
//
// Standard layout: width proportional to sample count, one fixed-height
// row per stack depth, root at the bottom growing upward (matches
// flamegraph.pl's default orientation). Self-contained: inline <style>/
// <script>, no external resources, so the file opens directly in a
// browser (file://) or embeds cleanly in an Artifact/HTML page.

const ROW_HEIGHT = 17
const WIDTH = 1200
const total = root.value || 1

function countDepth (node, d = 0) {
  let max = d
  for (const c of node.children.values()) max = Math.max(max, countDepth(c, d + 1))
  return max
}
const depth = countDepth(root)
const HEIGHT = (depth + 1) * ROW_HEIGHT + 40

// Deterministic warm palette (reds/oranges/yellows), same family
// flamegraph.pl uses, hashed from the function name so the same symbol
// gets a stable-ish color across a render.
function colorFor (name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const r = 200 + (h % 55)
  const g = 60 + ((h >>> 8) % 130)
  const b = 30 + ((h >>> 16) % 40)
  return `rgb(${r},${g},${b})`
}

function esc (s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const rects = []
function layout (node, depthIdx, x0, x1) {
  const w = x1 - x0
  if (w <= 0) return
  const y = HEIGHT - 20 - (depthIdx + 1) * ROW_HEIGHT
  const pct = ((node.value / total) * 100).toFixed(2)
  if (depthIdx >= 0) {
    rects.push({
      x: x0, y, w, h: ROW_HEIGHT,
      name: node.name, value: node.value, pct,
      color: node.name === 'root' ? '#cccccc' : colorFor(node.name)
    })
  }
  let cx = x0
  // Widest children first is cosmetic only; sort by insertion for stable output.
  for (const child of node.children.values()) {
    const cw = (child.value / total) * (x1 - x0)
    layout(child, depthIdx + 1, cx, cx + cw)
    cx += cw
  }
}
layout(root, -1, 0, WIDTH)

const svgRects = rects.map(r => {
  const label = r.w > 40 ? esc(r.name).slice(0, Math.floor(r.w / 6)) : ''
  return `<g class="frame" data-name="${esc(r.name)}">` +
    `<title>${esc(r.name)} (${r.value} samples, ${r.pct}%)</title>` +
    `<rect x="${r.x.toFixed(2)}" y="${r.y}" width="${r.w.toFixed(2)}" height="${r.h - 1}" fill="${r.color}" stroke="white" stroke-width="0.5"/>` +
    (label ? `<text x="${(r.x + 2).toFixed(2)}" y="${r.y + 12}" font-size="10" font-family="monospace" fill="black">${label}</text>` : '') +
    `</g>`
}).join('\n')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<style>.frame rect{cursor:pointer} .frame:hover rect{stroke:black;stroke-width:1}</style>
<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="white"/>
<text x="10" y="15" font-size="13" font-family="sans-serif">Flame graph - ${total} samples - click a frame to zoom, click background to reset</text>
${svgRects}
<script><![CDATA[
(function(){
  var svg = document.currentScript.closest('svg');
  var full = ${WIDTH};
  var frames = Array.prototype.slice.call(svg.querySelectorAll('.frame'));
  var base = frames.map(function(f){
    var r = f.querySelector('rect'), t = f.querySelector('text');
    return { f: f, r: r, t: t, x: parseFloat(r.getAttribute('x')), w: parseFloat(r.getAttribute('width')), y: parseFloat(r.getAttribute('y')) };
  });
  function reset(){
    base.forEach(function(b){
      b.r.setAttribute('x', b.x); b.r.setAttribute('width', b.w);
      if (b.t) { b.t.setAttribute('x', b.x + 2); b.t.style.display = b.w > 40 ? '' : 'none'; }
    });
  }
  svg.addEventListener('click', function(e){
    var g = e.target.closest ? e.target.closest('.frame') : null;
    if (!g) { reset(); return; }
    var idx = frames.indexOf(g);
    var clicked = base[idx];
    var y = clicked.y;
    var scale = full / clicked.w;
    var offset = clicked.x;
    base.forEach(function(b){
      if (b.y > y || (b.y === y && b === clicked)) {
        var nx = (b.x - offset) * scale;
        var nw = b.w * scale;
        b.r.setAttribute('x', nx); b.r.setAttribute('width', nw);
        if (b.t) { b.t.setAttribute('x', nx + 2); b.t.style.display = nw > 40 ? '' : 'none'; }
      } else {
        b.r.setAttribute('width', 0);
        if (b.t) b.t.style.display = 'none';
      }
    });
  });
})();
]]></script>
</svg>
`

writeFileSync(outPath, svg)
console.error(`wrote ${rects.length} frames (${folded.size} distinct stacks, ${total} samples) to ${outPath}`)
