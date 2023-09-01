import { Database } from 'lib/sqlite.js'
import { run } from 'lib/bench.js'

// todo: pragmas
const db = (new Database()).open('./northwind.sqlite')

const order = db.prepare('select * from "Order"').compile('Order', true)
const product = db.prepare('select * from "Product"').compile('Product', true)
const orderDetail = db.prepare('select * from "OrderDetail" limit 65536').compile('OrderDetail', true)

//run('Order', () => order.all(), 100, 10)
run('Product', () => product.all(), 60000, 10)
//run('OrderDetail', () => orderDetail.all(), 120, 10)
