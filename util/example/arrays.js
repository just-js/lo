const array = new Array(10000000)
	.fill(null)
	.map((_) => Math.floor(Math.random() * 100));

const len = array.length

const forLoop = () => {
  let result = 0
  const start = Date.now()
  for (let i = 0; i < len; i++) {
    if (array[i] > 50) result++
  }
  console.log(Date.now() - start)
}

while (1) forLoop()
