const N2N = require('../lib').N2N
const assert = require('assert')
const utils = require('../lib/utils')

describe('N2N connection', function () {
  this.timeout(2 * 60 * 1000)
  it('offline connection, connect method with inview/outview', async () => {
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
    return new Promise((resolve, reject) => {
      a.connect(b).then(() => {
        assert.strictEqual(a.getNeighboursIds().length, 1)
        assert.strictEqual(b.getNeighboursIds().length, 0)
        resolve()
      }).catch(e => {
        reject(e)
      })
    })
  })

  it('offline connection send function', async () => {
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
    await a.connect(b)
    return new Promise((resolve, reject) => {
      a.send(b.id, 'miaou').then(() => {
        console.log('[test] message sent.')
      }).catch(e => {
        reject(e)
      })
      a.on('receive', (id, message) => {
        assert.strictEqual(message, 'reply')
        resolve()
      })
      b.on('receive', (id, data) => {
        console.log('[test] receive: ', id, data)
        assert.strictEqual(data, 'miaou')
        b.send(a.id, 'reply')
      })
    })
  })

  it('offline connection, check inview/outview', async () => {
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
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await utils.timeout(1000)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 0)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 0)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 6)
    assert.strictEqual(a.view.livingOutview.get(b.id).lock, 0)
  })

  it('offline connection, check inview/outview', async () => {
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
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await utils.timeout(1000)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 0)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 0)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 6)
    assert.strictEqual(a.view.livingOutview.get(b.id).lock, 0)
  })
  it('offline connection+disconnection, need to be 0 in both sides', async () => {
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
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await utils.timeout(1000)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 0)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 0)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 6)
    assert.strictEqual(a.view.livingOutview.get(b.id).lock, 0)
    await b.connect(a)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 1)
    assert.strictEqual(a.view.livingInview.size, 1)
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 1)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 6)
    assert.strictEqual(a.view.livingOutview.get(b.id).lock, 0)
    assert.strictEqual(b.view.livingOutview.get(a.id).occurences, 1)
    assert.strictEqual(b.view.livingOutview.get(a.id).lock, 0)
    await a.disconnect()
    await utils.timeout(1000)
    assert.strictEqual(a.getNeighboursIds().length, 0)
    assert.strictEqual(b.getNeighboursIds().length, 1)
    assert.strictEqual(a.view.livingInview.size, 1)
    assert.strictEqual(a.view.livingOutview.size, 0)
    assert.strictEqual(b.view.livingInview.size, 0)
    assert.strictEqual(b.view.livingOutview.size, 1)
  })

  it('offline connection+disconnection, need to be 0 in both sides', async () => {
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
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    await utils.timeout(1000)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 0)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 0)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 6)
    assert.strictEqual(a.view.livingOutview.get(b.id).lock, 0)
    await b.connect(a)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 1)
    assert.strictEqual(a.view.livingInview.size, 1)
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 1)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 6)
    assert.strictEqual(a.view.livingOutview.get(b.id).lock, 0)
    assert.strictEqual(b.view.livingOutview.get(a.id).occurences, 1)
    assert.strictEqual(b.view.livingOutview.get(a.id).lock, 0)
    await a.disconnect()
    await utils.timeout(1000)
    assert.strictEqual(a.getNeighboursIds().length, 0)
    assert.strictEqual(b.getNeighboursIds().length, 1)
    assert.strictEqual(a.view.livingInview.size, 1)
    assert.strictEqual(a.view.livingOutview.size, 0)
    assert.strictEqual(b.view.livingInview.size, 0)
    assert.strictEqual(b.view.livingOutview.size, 1)
    await b.disconnect()
    assert.strictEqual(a.getNeighboursIds().length, 0)
    assert.strictEqual(b.getNeighboursIds().length, 0)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 0)
    assert.strictEqual(b.view.livingInview.size, 0)
    assert.strictEqual(b.view.livingOutview.size, 0)
  })
}) // end describe
