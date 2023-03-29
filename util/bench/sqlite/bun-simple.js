import { Database } from 'bun:sqlite'
import { run } from '../../../lib/bench.js'

const db = Database.open(':memory:')
db.exec('pragma user_version = 100')
const stmt = db.prepare('pragma user_version')
assert(stmt.get().user_version == 100)
run('pragma user_version', () => stmt.get(), 10000000, 20)
