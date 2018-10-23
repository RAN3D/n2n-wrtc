const N2N = require('../lib').N2N
const assert = require('assert')
const utils = require('../lib/utils')

describe('[Neighborhood] Offline connection', function () {
  this.timeout(2 * 60 * 1000)
  it('bridge', async () => {
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
    let [ca, cb, cc] = [0, 0, 0] // eslint-disable-line
    a.on('out', (id) => {
      ca++
    })
    b.on('out', (id) => {
      cb++
    })
    c.on('out', (id) => {
      cc++
    })
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
    assert.strictEqual(b.view.livingOutview.isIn(b.id), false)
    await b.connect(c)
    assert.strictEqual(b.view.livingOutview.get(c.id).occurences, 1)
    assert.strictEqual(c.view.livingOutview.isIn(b.id), false)
    assert.strictEqual(c.view.livingInview.get(b.id).occurences, 1)
    await b.bridge(a.id, c.id)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
    assert.strictEqual(a.view.livingOutview.get(c.id).occurences, 1)
    assert.strictEqual(c.view.livingOutview.isIn(b.id), false)
    assert.strictEqual(c.view.livingOutview.isIn(a.id), false)
    assert.strictEqual(c.view.livingInview.get(b.id).occurences, 1)
    assert.strictEqual(c.view.livingInview.has(a.id), true)
    await b.bridge(c.id, a.id)
    assert.strictEqual(c.view.livingOutview.get(a.id).occurences, 1)
    assert.strictEqual(c.view.livingOutview.isIn(b.id), false)
    assert.strictEqual(c.view.livingOutview.isIn(a.id), true)
    assert.strictEqual(c.view.livingInview.get(b.id).occurences, 1)
    assert.strictEqual(c.view.livingInview.has(a.id), true)
    await utils.timeout(1000)
    assert.strictEqual(ca, 2)
    assert.strictEqual(cb, 1)
    assert.strictEqual(cc, 1)
  })
})
