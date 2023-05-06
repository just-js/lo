import { Database, sqlite } from 'lib/sqlite.js'

const { ROW, OK, DONE } = sqlite.constants
const { assert } = spin
const { readFile } = spin.fs

const db = (new Database()).open('bbc.db')
db.exec("PRAGMA auto_vacuum = none");
db.exec("PRAGMA temp_store = memory");
db.exec("PRAGMA locking_mode = exclusive");
db.exec(`CREATE TABLE IF NOT EXISTS programme (
  path TEXT,
  size INT,
  name TEXT,
  pid TEXT PRIMARY KEY,
  channel TEXT,
  duration INT,
  description TEXT,
  longDescription TEXT,
  episode TEXT,
  broadcast TEXT,
  title TEXT,
  type TEXT,
  thumbnail TEXT
)`)

const query = db.prepare(`INSERT OR IGNORE INTO programme (
  path, size, name, pid, channel, duration, description, longDescription, 
  episode, broadcast, title, type, thumbnail
) values (
  @payload, @size, @name, @pid, @channel, @duration, @description, 
  @longDescription, @episode, @broadcast, @title, @type, @thumbnail
)`)

function createProgramme (programme) {
  const {
    path, size, name, pid, channel, duration, description, longDescription, 
    episode, broadcast, title, type, thumbnail
  } = programme
  query.bindText(1, path)
  query.bindInt(2, size)
  query.bindText(3, name)
  query.bindText(4, pid)
  query.bindText(5, channel)
  query.bindInt(6, duration)
  query.bindText(7, description)
  query.bindText(8, longDescription)
  query.bindText(9, episode)
  query.bindText(10, broadcast)
  query.bindText(11, title)
  query.bindText(12, type)
  query.bindText(13, thumbnail)
  const rc = query.step()
  query.reset()
  return rc
}

function loadPage (page) {
  return readFile(`./scratch/web/external/bbc.${page}.json`)
}

const decoder = new TextDecoder()
const programmes = [0, 1, 2, 3]
  .map(page => {
    return JSON.parse(decoder.decode(loadPage(page)))
  })
  .flat()

const tags = new Set()
const pids = new Set()

for (const programme of programmes) {
  pids.add(programme.pid)
  programme.tags.forEach(t => tags.add(t))
  assert(createProgramme(programme) === DONE)
}

const allTags = Array.from(tags.values()).map(v => v.trim()).sort()
const allPids = Array.from(pids.values()).map(v => v.trim()).sort()

//console.log(JSON.stringify(allTags, null, '  '))
console.log(allTags.length)

//console.log(JSON.stringify(allPids, null, '  '))
console.log(allPids.length)

function transformPid (pid) {
  const [crid, ...ids] = pid.split('')
  let power = 0
  for (const id of ids.reverse()) {
    let v = 0
    const code = id.charCodeAt(0)
    if (code >= 48 && code <= 57) {

    }
  }

}

//console.log(JSON.stringify(allPids.map(transformPid), null, '  '))

db.exec('vacuum')
query.finalize()
db.close()

/*
we only need to store the filename of the thumbnail as the prefix is always

https://ichef.bbci.co.uk/images/ic/192x108/

there are 109 unique tags

each pid is a single character CRID followed by 7 ascii characters that
can be lowercase a-z (less a,e,i,o,u) and 0-9
https://smethur.st/posts/176135860

we could use 36 bits to encode the pid

Math.pow(2, 35) - Math.pow(31, 7)
6847124257

Math.pow(2, 35) - (31 * 31 * 31 * 31 * 31 * 31 * 31)
6847124257
*/