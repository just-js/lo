import { Database } from 'bun:sqlite'
import { Bench } from '../../../lib/bench.js'

const db = Database.open("./northwind.sqlite")

const order = db.prepare(`select * from "Order"`)
const product = db.prepare('select * from "Product"')
const orderDetail = db.prepare('select * from "OrderDetail" limit 65536')

const bencher = new Bench()
const repeat = 5

for (let j = 0; j < repeat; j++) {
  bencher.start('order.all')
  for (let i = 0; i < 100; i++) order.all()
  bencher.end(100)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('product.all')
  for (let i = 0; i < 60000; i++) product.all()
  bencher.end(60000)
}

for (let j = 0; j < repeat; j++) {
  bencher.start('orderDetail.all')
  for (let i = 0; i < 120; i++) orderDetail.all()
  bencher.end(120)
}
