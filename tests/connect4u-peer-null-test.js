const N2N = require('../lib').N2N
const assert = require('assert')

describe('[N2N] Offline connection', function () {
  this.timeout(10 * 1000)
  it('connect4u from peer to us', async () => {
    const a = new N2N({
      socket: {
        trickle: true,
        moc: true
      }
    })
    const b = new N2N({
      socket: {
        trickle: true,
        moc: true
      }
    })
    const c = new N2N({
      socket: {
        trickle: true,
        moc: true
      }
    })
    await a.connect(b)
    assert.strictEqual(a.livingOutview.get(b.id).occurences, 1)
    assert.strictEqual(b.livingOutview.has(b.id), false)
    await b.connect(c)
    assert.strictEqual(b.livingOutview.get(c.id).occurences, 1)
    assert.strictEqual(c.livingOutview.has(b.id), false)
    assert.strictEqual(c.livingInview.get(b.id).occurences, 1)
    await b.connect4u(c.id, null)
    assert.strictEqual(b.livingOutview.get(c.id).occurences, 1)
    assert.strictEqual(c.livingOutview.has(b.id), true)
    assert.strictEqual(c.livingOutview.get(b.id).occurences, 1)
    assert.strictEqual(c.livingInview.get(b.id).occurences, 1)
  })
})
