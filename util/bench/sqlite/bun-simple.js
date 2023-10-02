import { Database } from 'bun:sqlite'
import { run } from '../../../lib/bench.js'

const db = Database.open(':memory:')
db.exec('pragma user_version = 100')
const stmt = db.prepare('pragma user_version')

assert(stmt.get().user_version === 100)

//for (let i = 0; i < 1000; i++) {
//  db.exec(`pragma user_version = ${i}`)
//  assert(stmt.get().user_version === i)
//}

run('pragma user_version.get', () => stmt.get(), 10000000, 20)
//run('pragma user_version.all', () => stmt.all(), 10000000, 20)

stmt.finalize()
db.close()
