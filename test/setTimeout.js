const timer3000 = setTimeout(() => {
  console.log(3000)
}, 3000)

setTimeout(() => {
  console.log(1000)
  clearTimeout(timer3000)
  setTimeout(() => {
    console.log(2000)
  }, 2000)
}, 1000)

const timerInterval = setInterval(() => {
  console.log(lo.hrtime() - lo.start)
}, 1000)

setTimeout(() => {
  clearInterval(timerInterval)
}, 5000)
