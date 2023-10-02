import { Database } from 'bun:sqlite'
import { run } from '../../../lib/bench.js'

const db = Database.open(':memory:')

const version = db.prepare('pragma user_version')

function updateandget () {
  db.exec(`pragma user_version = ${version.get().user_version + 1}`)  
}

updateandget()
assert(version.get().user_version === 1)

run('get and update version', updateandget, 1000000, 20)

stmt.finalize()
db.close()
