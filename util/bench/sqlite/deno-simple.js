import { Database } from './sqlite3/mod.ts'
import { run } from '../../../lib/bench.js'

const db = new Database(':memory:')
db.exec('pragma user_version = 100')
const sql = db.prepare('pragma user_version')
run('pragma user_version', () => sql.get(), 10000000, 20)
