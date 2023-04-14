import { Database } from 'lib/sqlite.js'
import { run } from 'lib/bench.js'

const db = new Database()
db.open(':memory:')
db.exec('pragma user_version = 100')
const stmt = db.prepare('pragma user_version').compile('Pragma', true)
console.log(JSON.stringify(stmt.get()))
assert(stmt.get().user_version == 100)
run('pragma user_version', () => stmt.get(), 10000000, 20)
stmt.finalize()
db.close()
