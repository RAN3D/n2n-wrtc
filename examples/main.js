console.log(n2n) // eslint-disable-line
let g = new sigma({ // eslint-disable-line
  renderer: {
    container: 'network',
    type: 'canvas'
  },
  settings: Object.assign(sigma.settings, { // eslint-disable-line
    defaultEdgeType: 'curvedArrow',
    minArrowSize: 10,
    scalingMode: 'inside',
    sideMargin: 0.5
  }) // eslint-disable-line
}) // eslint-disable-line
const moc = false
localStorage.debug = 'n2n:direct' // eslint-disable-line

const a = createNode('a', 0, 0)
const b = createNode('b', 1, 0)
const c = createNode('c', 0.5, 1)

g.refresh()

async function connection () {
  await a.connect(b) // connected, becasue he is alone
  await b.connect(c) // connected, becasue he is alone
  await b.connectBridge(a.id, c.id)
}

function createNode (name, x, y) {
  const node = new n2n.N2N({ // eslint-disable-line
    n2n: {
      id: name
    },
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
    'size': 2,
    color: randomColor()
  })
  node.on('out', (id, outview) => {
    console.log('%s opens a con: ', node.id, id, outview)
    if (!g.graph.edges(node.id + id)) {
      g.graph.addEdge({
        id: node.id + id,
        source: node.id,
        target: id
      })
      g.refresh()
    }
  })
  node.on('close_in', (id, fail) => {
    console.log('%s closes an inview connection with %s, fail: %s', node.id, id, fail)
  })
  node.on('close_out', (id, fail) => {
    console.log('%s closes an outview connection with %s, fail: %s', node.id, id, fail)
  })
  node.on('receive', (id, message) => {
    console.log('%s receive a message  from %s:', node.id, id, message)
  })
  return node
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

function randomColor () {
  const letters = '0123456789ABCDEF'
  let color = '#'
  for (let i = 0; i < 3; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
};
