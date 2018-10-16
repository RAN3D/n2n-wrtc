console.log(n2n) // eslint-disable-line
let Moc = n2n.Moc // eslint-disable-line
localStorage.debug = 'spa'
let g = new sigma('network')
const a = new n2n.N2N({ // eslint-disable-line
  socket: {
    trickle: true,
    moc: true
  }
})
a.on('receive', (id, message) => {
  console.log('A receive a message from %s: ', id, message)
})
g.graph.addNode({
  'id': a.id,
  'firstLabel': a.id,
  'label': a.id,
  'x': 0,
  'y': 0,
  'size': 3
})
const b = new n2n.N2N({ // eslint-disable-line
  socket: {
    trickle: true,
    moc: true
  }
})
b.on('receive', (id, message) => {
  console.log('B receive a message from %s: ', id, message)
})
g.graph.addNode({
  'id': b.id,
  'firstLabel': b.id,
  'label': b.id,
  'x': 1,
  'y': 0,
  'size': 3
})
a.on('close', (id) => {
  console.log('a closes a con: ', id)
})
b.on('close', (id) => {
  console.log('b closes a con: ', id)
})
a.on('connect', (id) => {
  console.log('a opens a con: ', id)
  if (!g.graph.edges(a.id + id)) {
    g.graph.addEdge({
      'id': a.id + id,
      'source': a.id,
      'target': id
    })
    g.refresh()
  }
})
b.on('connect', (id) => {
  console.log('b opens a con: ', id)
  if (!g.graph.edges(b.id + id)) {
    g.graph.addEdge({
      'id': b.id + id,
      'source': b.id,
      'target': id
    })
    g.refresh()
  }
})
g.refresh()

async function connection () {
  await a.connect(b) // connected, becasue he is alone
  await b.connect(a) // B => A
  await a.connect(b) // A => B: 1:1 1:1
  return a.send(b.id, 'meow')
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
