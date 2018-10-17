console.log(n2n) // eslint-disable-line
let g = new sigma('network')
const a = new n2n.N2N({ // eslint-disable-line
  socket: {
    trickle: true
  }
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
    trickle: true
  }
})
g.graph.addNode({
  'id': b.id,
  'firstLabel': b.id,
  'label': b.id,
  'x': 1,
  'y': 0,
  'size': 3
})
a.on('close', (id, outview) => {
  console.log('%s closes a con: ', a.id, id, outview)
})
b.on('close', (id, outview) => {
  console.log('%s closes a con: ', b.id, id, outview)
})
a.on('connect', (id, outview) => {
  console.log('%s opens a con: ', a.id, id, outview)
  if (!g.graph.edges(a.id + id)) {
    g.graph.addEdge({
      'id': a.id + id,
      'source': a.id,
      'target': id
    })
    g.refresh()
  }
})
b.on('connect', (id, outview) => {
  console.log('%s opens a con: ', b.id, id, outview)
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
  await a.connect(b) // connected, becasue he is alone
  await b.connect(a) // B => A
  return a.connect(b) // A => B: 1:1 1:1
}

connection().then(() => {
  neigh()
})

function neigh () {
  console.log('A:inview: ', a.getNeighboursInview().map(p => p.peer.occurences), 'A:outview', a.getNeighboursOutview().map(p => p.peer.occurences))
  console.log('B:inview', b.getNeighboursInview().map(p => p.peer.occurences), 'B:outview', b.getNeighboursOutview().map(p => p.peer.occurences))
  console.log(a.getNeighbours(), b.getNeighbours())
  g.refresh()
}
