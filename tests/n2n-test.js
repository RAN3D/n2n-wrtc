const N2N = require('../lib').N2N
const wrtc = require('wrtc')
const assert = require('assert')
const utils = require('../lib/utils')
let ss

describe('N2N connection', function () {
  this.timeout(2 * 60 * 1000)
  before((done) => {
    utils.startServer().then(signaling => {
      ss = signaling
      console.log('SS started.')
      done()
    })
  })
  after(() => {
    utils.stopServer(ss)
  })
  it('offline connection, connect method with inview/outview', async () => {
    const a = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    const peers = []
    return new Promise((resolve, reject) => {
      const cb = (error) => {
        if (error) reject(error)
        checkNeighbours(a, b).then(() => {
          resolve()
        }).catch(e => {
          console.error(e)
          reject(e)
        })
      }
      a.on('connect', (id) => {
        console.log('A(%s) is connected to %s', a.id, id)
        assert.strictEqual(id, b.id)
        const neigh = a.getNeighbours()
        assert.strictEqual(neigh.get(id).inview, 0)
        assert.strictEqual(neigh.get(id).outview, 1)
        check(peers, a, 2, cb)
      })
      b.on('connect', (id) => {
        console.log('B(%s) is connected to %s', b.id, id)
        assert.strictEqual(id, a.id)
        const neigh = b.getNeighbours()
        assert.strictEqual(neigh.get(id).inview, 1)
        assert.strictEqual(neigh.get(id).outview, 0)
        check(peers, b, 2, cb)
      })
      a.connect(b)
    })
  })

  it('offline connection send function', async () => {
    const a = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    await a.connect(b)
    return new Promise((resolve, reject) => {
      b.on('receive', (id, message) => {
        assert.strictEqual(message, 'meow')
        resolve()
      })
      a.send(b.id, 'meow').catch(e => {
        console.error(e)
        reject(e)
      })
    })
  })

  it('offline connection, check inview/outview', async () => {
    const a = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    await a.connect(b)
    let neigha = a.getNeighbours()
    assert.strictEqual(neigha.get(b.id).inview, 0)
    assert.strictEqual(neigha.get(b.id).outview, 1)
    let neighb = b.getNeighbours()
    assert.strictEqual(neighb.get(a.id).inview, 1)
    assert.strictEqual(neighb.get(a.id).outview, 0)
    console.log('a: ', neigha.get(b.id).inview, neigha.get(b.id).outview)
    console.log('b: ', neighb.get(a.id).inview, neighb.get(a.id).outview)

    await a.connect(b)
    neigha = a.getNeighbours()
    assert.strictEqual(neigha.get(b.id).inview, 0)
    assert.strictEqual(neigha.get(b.id).outview, 2)
    neighb = b.getNeighbours()
    assert.strictEqual(neighb.get(a.id).inview, 2)
    assert.strictEqual(neighb.get(a.id).outview, 0)
    console.log('a: ', neigha.get(b.id).inview, neigha.get(b.id).outview)
    console.log('b: ', neighb.get(a.id).inview, neighb.get(a.id).outview)

    await b.connect(a)
    neigha = a.getNeighbours()
    assert.strictEqual(neigha.get(b.id).inview, 1)
    assert.strictEqual(neigha.get(b.id).outview, 2)
    neighb = b.getNeighbours()
    assert.strictEqual(neighb.get(a.id).inview, 2)
    assert.strictEqual(neighb.get(a.id).outview, 1)
    console.log('a: ', neigha.get(b.id).inview, neigha.get(b.id).outview)
    console.log('b: ', neighb.get(a.id).inview, neighb.get(a.id).outview)
  })

  it('online connection, check inview/outview', async () => {
    const a = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    await b.connect()
    await a.connect()
    let neigha = a.getNeighbours()
    let neighb = b.getNeighbours()
    console.log('a: ', neigha.get(b.id).inview, neigha.get(b.id).outview)
    console.log('b: ', neighb.get(a.id).inview, neighb.get(a.id).outview)
    assert.strictEqual(neigha.get(b.id).inview, 0)
    assert.strictEqual(neigha.get(b.id).outview, 1)
    assert.strictEqual(neighb.get(a.id).inview, 1)
    assert.strictEqual(neighb.get(a.id).outview, 0)

    await a.connect()
    neigha = a.getNeighbours()
    neighb = b.getNeighbours()
    console.log('a: ', neigha.get(b.id).inview, neigha.get(b.id).outview)
    console.log('b: ', neighb.get(a.id).inview, neighb.get(a.id).outview)
    assert.strictEqual(neighb.get(a.id).inview, 2)
    assert.strictEqual(neighb.get(a.id).outview, 0)
    assert.strictEqual(neigha.get(b.id).inview, 0)
    assert.strictEqual(neigha.get(b.id).outview, 2)

    await b.connect()
    neigha = a.getNeighbours()
    neighb = b.getNeighbours()
    console.log('a: ', neigha.get(b.id).inview, neigha.get(b.id).outview)
    console.log('b: ', neighb.get(a.id).inview, neighb.get(a.id).outview)
    assert.strictEqual(neighb.get(a.id).inview, 2)
    assert.strictEqual(neighb.get(a.id).outview, 1)
    assert.strictEqual(neigha.get(b.id).inview, 1)
    assert.strictEqual(neigha.get(b.id).outview, 2)
  })

  it('offline connection+disconnection, need to be 0 in both sides', async () => {
    const a = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    a.on('close', (id) => {
      console.log('a closes a con: ', id)
    })
    b.on('close', (id) => {
      console.log('b closes a con: ', id)
    })
    await a.connect(b)
    await a.connect(b)
    await b.connect(a)
    let neigha = a.getNeighbours()
    let neighb = b.getNeighbours()
    console.log('a: ', neigha.get(b.id).inview, neigha.get(b.id).outview)
    console.log('b: ', neighb.get(a.id).inview, neighb.get(a.id).outview)
    assert.strictEqual(neighb.get(a.id).inview, 2)
    assert.strictEqual(neighb.get(a.id).outview, 1)
    assert.strictEqual(neigha.get(b.id).inview, 1)
    assert.strictEqual(neigha.get(b.id).outview, 2)
    await a.disconnect()
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        neigha = a.getNeighbours()
        neighb = b.getNeighbours()
        console.log('a: ', neigha)
        console.log('b: ', neighb)
        if (neigha.size === 0 && neighb.size === 0) resolve()
        reject(new Error('both view need to be at zero.'))
      }, 0)
    })
  })
  it('offline connection+disconnection, need to just decrease the outview/inview', async () => {
    const a = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    a.on('close', (id) => {
      console.log('a closes a con: ', id)
    })
    b.on('close', (id) => {
      console.log('b closes a con: ', id)
    })
    await a.connect(b)
    await a.connect(b)
    await b.connect(a)
    console.log(a.getNeighboursInview(), a.getNeighboursOutview())
    console.log(b.getNeighboursInview(), b.getNeighboursOutview())
    let neigha = a.getNeighbours()
    let neighb = b.getNeighbours()
    // console.log('a: ', neigha.get(b.id).inview, neigha.get(b.id).outview)
    // console.log('b: ', neighb.get(a.id).inview, neighb.get(a.id).outview)
    assert.strictEqual(neighb.get(a.id).inview, 2)
    assert.strictEqual(neighb.get(a.id).outview, 1)
    assert.strictEqual(neigha.get(b.id).inview, 1)
    assert.strictEqual(neigha.get(b.id).outview, 2)
    await a.disconnect(b.id)
    console.log(a.getNeighboursInview(), a.getNeighboursOutview())
    console.log(b.getNeighboursInview(), b.getNeighboursOutview())
    return new Promise(async (resolve, reject) => {
      neigha = a.getNeighbours()
      neighb = b.getNeighbours()
      assert.strictEqual(neighb.get(a.id).inview, 1)
      assert.strictEqual(neighb.get(a.id).outview, 1)
      assert.strictEqual(neigha.get(b.id).inview, 1)
      assert.strictEqual(neigha.get(b.id).outview, 1)
      await a.disconnect(b.id)
      console.log(a.getNeighboursInview(), a.getNeighboursOutview())
      console.log(b.getNeighboursInview(), b.getNeighboursOutview())
      assert.strictEqual(neighb.get(a.id).inview, 0)
      assert.strictEqual(neighb.get(a.id).outview, 1)
      assert.strictEqual(neigha.get(b.id).inview, 1)
      assert.strictEqual(neigha.get(b.id).outview, 0)
      await b.disconnect(a.id)
      console.log(a.getNeighboursInview(), a.getNeighboursOutview())
      console.log(b.getNeighboursInview(), b.getNeighboursOutview())
      assert.strictEqual(neigha.size, 0)
      assert.strictEqual(neighb.size, 0)
      resolve()
    })
  })
  it('offline connection+disconnection, B disconnect, A need to remove connections', async () => {
    const a = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new N2N({
      socket: {
        trickle: true,
        wrtc
      }
    })
    a.on('close', (id) => {
      console.log('a closes a con: ', id)
    })
    b.on('close', (id) => {
      console.log('b closes a con: ', id)
    })
    await a.connect(b)
    await a.connect(b)
    await b.connect(a)
    await b.disconnect()
    return new Promise((resolve, reject) => {
      console.log(a.getNeighboursInview(), a.getNeighboursOutview())
      console.log(b.getNeighboursInview(), b.getNeighboursOutview())
      let neigha = a.getNeighbours()
      let neighb = b.getNeighbours()
      setTimeout(() => {
        console.log(a.getNeighboursInview(), a.getNeighboursOutview())
        console.log(b.getNeighboursInview(), b.getNeighboursOutview())
        assert.strictEqual(neigha.size, 0)
        assert.strictEqual(neighb.size, 0)
        // resolve()
      }, 1000)
    })
  })
}) // end describe

function checkNeighbours (a, b) {
  return new Promise((resolve, reject) => {
    const na = a.getNeighbours()
    const nb = b.getNeighbours()
    // console.log(a.getNeighbours())
    // console.log(b.getNeighbours())
    assert.strictEqual(na.has(b.id), true)
    assert.strictEqual(nb.has(a.id), true)
    resolve()
  })
}

function check (peers, peer, max, cb) {
  if (peers.length < max - 1) {
    peers.push(peer)
  } else if (peers.length === (max - 1)) {
    cb()
  } else {
    cb(new Error('please verify the number of peers'))
  }
}
