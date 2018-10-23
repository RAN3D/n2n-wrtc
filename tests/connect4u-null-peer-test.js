const N2N = require('../lib').N2N
const assert = require('assert')

describe('[Neighborhood] Offline connection', function () {
  this.timeout(2 * 60 * 1000)
  it('connect4u from us to peer', async () => {
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
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
    assert.strictEqual(b.view.livingOutview.isIn(b.id), false)
    await b.connect(c)
    assert.strictEqual(b.view.livingOutview.get(c.id).occurences, 1)
    assert.strictEqual(c.view.livingOutview.isIn(b.id), false)
    assert.strictEqual(c.view.livingInview.get(b.id).occurences, 1)
    await b.connect4u(null, c.id)
    assert.strictEqual(b.view.livingOutview.get(c.id).occurences, 2)
    assert.strictEqual(c.view.livingOutview.isIn(b.id), false)
    assert.strictEqual(c.view.livingInview.get(b.id).occurences, 1)
  })
})
