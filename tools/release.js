#!/usr/bin/env node
// Release lo for a V8 version: bump VERSION/V8 in Makefile and build.cmd on
// main, commit, tag, push, and optionally publish the GitHub prerelease that
// starts the release build (release.yml). Node 20+, no dependencies.
//
// usage: node tools/release.js [--release] [--dry-run] <lo-version> <v8-version>
//   e.g. node tools/release.js --release 0.0.36-pre 15.5
//
// 1. checks the just-js/v8 release <v8-version> has every asset lo downloads
// 2. on main: sets VERSION/V8_VERSION in Makefile and VERSION/V8 in build.cmd
//    (CRLF), commits only those two files as "chore: v8 <v8-version>"
//    (skipped if main already has them)
// 3. tags that commit <lo-version> and pushes main + the tag in one atomic push
//
//   --release  also publish the prerelease (needs $GH_TOKEN or $GITHUB_TOKEN
//              with Contents: Read and write). Re-running with --release when
//              the tag is already on origin with matching versions only publishes.
//   --dry-run  do every check, print what would happen, change nothing
//
// With --release, the release build is the build: the bump commit says
// "[skip ci]", so pushing main and the tag starts no push.yml runs, and any
// push runs for the tagged commit that start anyway (when main already had
// the versions, so no new commit) are cancelled after publishing.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const V8_REPO = 'just-js/v8'
const ASSETS = [
  'include.tar.gz', 'src.tar.gz',
  'libv8_monolith-linux-x64.a.gz', 'libv8_monolith-linux-arm64.a.gz',
  'libv8_monolith-mac-x64.a.gz', 'libv8_monolith-mac-arm64.a.gz',
  'libv8_monolith-win-x64.zip', 'libcxx-headers-win-x64.zip'
]
const LO_VERSION = /^\d+\.\d+\.\d+(-pre)?$/

function fail (msg) {
  console.error(msg)
  process.exit(1)
}

function git (...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function gitOk (...args) {
  try {
    execFileSync('git', args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function originRepo () {
  const url = git('remote', 'get-url', 'origin')
  const m = url.match(/github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/)
  if (!m) fail(`can't get owner/repo from origin remote ${url}`)
  return m[1]
}

// what a commit builds, from Makefile and build.cmd (CRLF); rev '' = working tree
function versions (rev) {
  const read = path => rev === '' ? readFileSync(path, 'utf8') : execFileSync('git', ['show', `${rev}:${path}`], { encoding: 'utf8' })
  const mk = read('Makefile')
  const cmd = read('build.cmd').replace(/\r/g, '')
  const get = (text, re) => (text.match(re) || [])[1]
  return [get(mk, /^VERSION=(.*)$/m), get(mk, /^V8_VERSION=(.*)$/m), get(cmd, /^set VERSION=(.*)$/m), get(cmd, /^set V8=(.*)$/m)].join(' ')
}

// compare x.y.z(-pre) by number; a -pre sorts before the same version without it
function compareLo (a, b) {
  const pa = a.replace('-pre', '').split('.').map(Number)
  const pb = b.replace('-pre', '').split('.').map(Number)
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2] || (b.endsWith('-pre') - a.endsWith('-pre'))
}

const args = process.argv.slice(2)
const release = args.includes('--release')
const dryRun = args.includes('--dry-run')
const [lo, v8] = args.filter(a => !a.startsWith('--'))
if (!LO_VERSION.test(lo || '') || !/^\d+\.\d+$/.test(v8 || '') ||
    args.some(a => a.startsWith('--') && a !== '--release' && a !== '--dry-run')) {
  fail('usage: node tools/release.js [--release] [--dry-run] <lo-version> <v8-version>   (e.g. 0.0.36-pre 15.5)')
}
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!token) fail('needs $GH_TOKEN or $GITHUB_TOKEN')
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  Authorization: `Bearer ${token}`
}
const want = `${lo} ${v8} ${lo} ${v8}`
const repo = originRepo()

// 1. the v8 release must be fully cooked
const v8res = await fetch(`https://api.github.com/repos/${V8_REPO}/releases/tags/${v8}`, { headers })
if (v8res.status !== 200) fail(`no ${V8_REPO} release ${v8} (HTTP ${v8res.status})`)
const have = new Set((await v8res.json()).assets.map(a => a.name))
const missing = ASSETS.filter(a => !have.has(a))
if (missing.length) fail(`${V8_REPO} release ${v8} is missing: ${missing.join(' ')}`)
console.log(`v8 ${v8}: all assets present`)

git('fetch', '-q', '--tags', 'origin')
const remote = git('ls-remote', '--tags', 'origin', `refs/tags/${lo}`).split('\t')[0]

if (remote) {
  if (!release || versions(remote) !== want) {
    fail(`tag ${lo} already exists on origin (${remote}, builds: ${versions(remote)})`)
  }
  console.log(`tag ${lo} already on origin at ${remote}`)
} else {
  if (gitOk('rev-parse', '-q', '--verify', `refs/tags/${lo}`)) fail(`tag ${lo} exists locally but not on origin`)
  if (git('branch', '--show-current') !== 'main') fail('not on main')
  if (git('rev-parse', 'main') !== git('rev-parse', 'origin/main')) fail('local main is not origin/main; pull or push first')
  if (git('status', '--porcelain', '--', 'Makefile', 'build.cmd')) fail('Makefile or build.cmd has local changes')
  // the commit must hold only the version bump, never anything else staged
  const staged = git('diff', '--cached', '--name-only')
  if (staged) fail(`other changes are staged; unstage them first:\n${staged}`)

  // 2. bump the versions unless main already has them
  if (versions('HEAD') !== want) {
    const mk = readFileSync('Makefile', 'utf8')
      .replace(/^VERSION=.*$/m, `VERSION=${lo}`)
      .replace(/^V8_VERSION=.*$/m, `V8_VERSION=${v8}`)
    const cmd = readFileSync('build.cmd', 'utf8')
      .replace(/^set VERSION=[^\r\n]*/m, `set VERSION=${lo}`)
      .replace(/^set V8=[^\r\n]*/m, `set V8=${v8}`)
    if (dryRun) {
      console.log(`would set ${versions('HEAD')} -> ${want} in Makefile, build.cmd and commit "chore: v8 ${v8}${release ? ' [skip ci]' : ''}"`)
    } else {
      writeFileSync('Makefile', mk)
      writeFileSync('build.cmd', cmd)
      git('add', '--', 'Makefile', 'build.cmd')
      const changed = git('diff', '--cached', '--numstat').split('\n')
      // each file: 1 or 2 lines replaced (VERSION, and V8 when it changes)
      if (versions('') !== want || changed.length !== 2 || !changed.every(l => /^([12])\t\1\t/.test(l))) {
        fail(`version edit went wrong, staged:\n${git('diff', '--cached')}`)
      }
      const subject = release ? `chore: v8 ${v8} [skip ci]` : `chore: v8 ${v8}`
      git('commit', '-q', '-m', subject)
      console.log(`committed ${git('rev-parse', '--short', 'HEAD')}: ${subject}`)
    }
  } else {
    console.log(`main already builds ${lo} with v8 ${v8}`)
  }

  // 3. tag and push
  if (dryRun) {
    console.log(`would tag it ${lo} and push main + the tag`)
  } else {
    const sha = git('rev-parse', 'HEAD')
    git('tag', lo, sha)
    git('push', '-q', '--atomic', 'origin', 'main', `refs/tags/${lo}`)
    console.log(`tagged ${sha} as ${lo} and pushed main + tag`)
  }
}

if (!release) process.exit(0)

const api = `https://api.github.com/repos/${repo}`
const existing = await fetch(`${api}/releases/tags/${lo}`, { headers })
if (existing.status !== 404) fail(`release ${lo} already exists (HTTP ${existing.status})`)

// same body as the earlier releases: "- V8 Version X" + the changelog link
const prev = git('tag', '--list').split('\n')
  .filter(t => LO_VERSION.test(t) && compareLo(t, lo) < 0)
  .sort(compareLo)
  .pop()
let body = `- V8 Version ${v8}`
if (prev) body += `\n\n**Full Changelog**: https://github.com/${repo}/compare/${prev}...${lo}`
const payload = { tag_name: lo, name: lo, body, draft: false, prerelease: true }

if (dryRun) {
  console.log(`would publish prerelease ${lo} on ${repo}:`)
  console.log(JSON.stringify(payload, null, 2))
  process.exit(0)
}

const res = await fetch(`${api}/releases`, { method: 'POST', headers, body: JSON.stringify(payload) })
if (res.status !== 201) fail(`creating release ${lo} failed (HTTP ${res.status}): ${await res.text()}`)
const created = await res.json()
console.log(`published prerelease ${lo}: ${created.html_url}`)
console.log(`release build: https://github.com/${repo}/actions/workflows/release.yml`)

// cancel push builds of the tagged commit: they duplicate the release build.
// Runs take a few seconds to appear after a push, so look three times.
const sha = git('rev-parse', `refs/tags/${lo}^{commit}`)
const cancelled = new Set()
for (let i = 0; i < 3; i++) {
  await new Promise(resolve => setTimeout(resolve, 10000))
  const runs = await fetch(`${api}/actions/runs?event=push&head_sha=${sha}`, { headers })
  if (!runs.ok) {
    console.error(`listing push runs failed (HTTP ${runs.status}); cancel any for ${sha.slice(0, 7)} by hand`)
    break
  }
  for (const run of (await runs.json()).workflow_runs) {
    if (run.status === 'completed' || cancelled.has(run.id)) continue
    const c = await fetch(`${api}/actions/runs/${run.id}/cancel`, { method: 'POST', headers })
    console.log(`cancelled push build ${run.id} (${run.head_branch}): HTTP ${c.status}`)
    cancelled.add(run.id)
  }
}
