import { Database } from "bun:sqlite";
import { run } from '../../../lib/bench.js'

const db = Database.open("./northwind.sqlite")

const order = db.prepare(`select * from "Order"`)
const product = db.prepare('select * from "Product"')
const orderDetail = db.prepare('select * from "OrderDetail" limit 65536')

run('Order', () => order.all(), 100, 10)
//run('Product', () => product.all(), 60000, 10)
//run('OrderDetail', () => orderDetail.all(), 120, 10)
