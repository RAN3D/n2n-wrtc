const N2N = require('../lib').N2N
const assert = require('assert')

describe('[N2N] Offline bridged connections', function () {
  this.timeout(2 * 60 * 1000)
  it('bridgeIO (a->b->c)', async () => {
    const a = new N2N({
      n2n: {
        id: 'a'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const b = new N2N({
      n2n: {
        id: 'b'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const c = new N2N({
      n2n: {
        id: 'c'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    await a.connect(b)
    assert.strictEqual(a.livingOutview.size, 1)
    assert.strictEqual(a.livingInview.size, 0)
    assert.strictEqual(a.pendingOutview.size, 0)
    assert.strictEqual(a.pendingInview.size, 0)
    assert.strictEqual(b.livingOutview.size, 0)
    assert.strictEqual(b.livingInview.size, 1)
    assert.strictEqual(b.pendingOutview.size, 0)
    assert.strictEqual(b.pendingInview.size, 0)
    await b.connect(c)
    assert.strictEqual(c.livingOutview.size, 0)
    assert.strictEqual(c.livingInview.size, 1)
    assert.strictEqual(b.livingInview.size, 1)
    assert.strictEqual(b.livingOutview.size, 1)
    await b.bridgeIO(a.id, c.id)
    assert.strictEqual(a.livingOutview.size, 2)
    assert.strictEqual(a.livingInview.size, 0)
    assert.strictEqual(c.livingOutview.size, 0)
    assert.strictEqual(c.livingInview.size, 2)
    assert.strictEqual(b.livingInview.size, 1)
    assert.strictEqual(b.livingOutview.size, 1)
  })
  it('bridgeOO (a<-b->c)', async () => {
    const a = new N2N({
      n2n: {
        id: 'a'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const b = new N2N({
      n2n: {
        id: 'b'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const c = new N2N({
      n2n: {
        id: 'c'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    await b.connect(a)
    assert.strictEqual(a.livingOutview.size, 0)
    assert.strictEqual(a.livingInview.size, 1)
    assert.strictEqual(a.pendingOutview.size, 0)
    assert.strictEqual(a.pendingInview.size, 0)
    assert.strictEqual(b.livingOutview.size, 1)
    assert.strictEqual(b.livingInview.size, 0)
    assert.strictEqual(b.pendingOutview.size, 0)
    assert.strictEqual(b.pendingInview.size, 0)
    await b.connect(c)
    assert.strictEqual(c.livingOutview.size, 0)
    assert.strictEqual(c.livingInview.size, 1)
    assert.strictEqual(c.pendingOutview.size, 0)
    assert.strictEqual(c.pendingInview.size, 0)
    assert.strictEqual(b.livingOutview.size, 2)
    assert.strictEqual(b.livingInview.size, 0)
    assert.strictEqual(b.pendingOutview.size, 0)
    assert.strictEqual(b.pendingInview.size, 0)
    await b.bridgeOO(a.id, c.id)
  })
  it('bridgeOI (a<-b<-c)', async () => {
    const a = new N2N({
      n2n: {
        id: 'a'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const b = new N2N({
      n2n: {
        id: 'b'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const c = new N2N({
      n2n: {
        id: 'c'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    await b.connect(a)
    await c.connect(b)
    await b.bridgeOI(a.id, c.id)
  })
})
