console.log(n2n) // eslint-disable-line
let g = new sigma('network') // eslint-disable-line
const moc = false
localStorage.debug = 'n2n:direct'

const a = createNode(0, 0)
const b = createNode(1, 0)
const c = createNode(0.5, 1)

g.refresh()

async function connection () {
  await a.connect(b) // connected, becasue he is alone
  await b.connect(c) // connected, becasue he is alone
  // b.view.lock(c.id)
  await b.connectBridge(a.id, c.id)
}

function createNode (x, y) {
  const node = new n2n.N2N({ // eslint-disable-line
    socket: {
      trickle: true,
      moc
    }
  })
  g.graph.addNode({
    'id': node.id,
    'firstLabel': node.id,
    'label': node.id,
    'x': x,
    'y': y,
    'size': 3
  })
  node.on('connect', (id, outview) => {
    console.log('%s opens a con: ', node.id, id, outview)
    if (!g.graph.edges(node.id + id)) {
      g.graph.addEdge({
        'id': node.id + id,
        'source': node.id,
        'target': id
      })
      g.refresh()
    }
  })
  node.on('close', (id, outview) => {
    console.log('%s closes a con: ', node.id, id, outview)
  })
  node.on('receive', (id, message) => {
    console.log('%s receive a message  from %s:', node.id, id, message)
  })
  return node
}

function listeners (s) {

}

connection().then(() => {
  neigh()
})

function neigh () {
  console.log('A:inview: ', a.getNeighboursInview().map(p => p.peer.occurences), 'A:outview', a.getNeighboursOutview().map(p => p.peer.occurences))
  console.log('B:inview', b.getNeighboursInview().map(p => p.peer.occurences), 'B:outview', b.getNeighboursOutview().map(p => p.peer.occurences))
  console.log('C:inview: ', c.getNeighboursInview().map(p => p.peer.occurences), 'C:outview', c.getNeighboursOutview().map(p => p.peer.occurences))
  console.log(a.getNeighbours(), b.getNeighbours(), c.getNeighbours())
  g.refresh()
}
