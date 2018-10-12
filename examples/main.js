console.log(n2n) // eslint-disable-line
const a = new n2n.N2N({ // eslint-disable-line
  socket: {
    trickle: true
  }
})
const b = new n2n.N2N({ // eslint-disable-line
  socket: {
    trickle: true
  }
})
a.on('close', (id) => {
  console.log('a closes a con: ', id)
})
b.on('close', (id) => {
  console.log('b closes a con: ', id)
})

async function connection () {
  await a.connect() // 0:0
  await b.connect() // B => A
  return a.connect() // A => B: 1:1 1:1
}

connection().then(() => {
  console.log()
  console.log(a.getNeighboursInview(), a.getNeighboursOutview())
  console.log(b.getNeighboursInview(), b.getNeighboursOutview())
})

function neigh () {
  console.log(a.getNeighboursInview(), a.getNeighboursOutview())
  console.log(b.getNeighboursInview(), b.getNeighboursOutview())
  console.log(a.getNeighbours(), b.getNeighbours())
}
