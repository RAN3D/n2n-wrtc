const N2N = require('../lib').N2N
const assert = require('assert')

describe('[Neighborhood] Offline bridged connections', function () {
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
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    await b.connect(c)
    assert.strictEqual(c.view.livingOutview.size, 0)
    assert.strictEqual(c.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 1)
    await b.bridgeIO(a.id, c.id)
    assert.strictEqual(a.view.livingOutview.size, 2)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(c.view.livingOutview.size, 0)
    assert.strictEqual(c.view.livingInview.size, 2)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 1)
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
    await b.connect(c)
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
