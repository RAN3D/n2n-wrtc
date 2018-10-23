const N2N = require('../lib').N2N
const assert = require('assert')
const utils = require('../lib/utils')
const socket = {
  moc: false,
  wrtc: require('wrtc'),
  tricle: true
}
describe('N2N connection', function () {
  this.timeout(30 * 1000)
  it('offline connection, connect method with inview/outview', async () => {
    const a = new N2N({
      socket
    })
    const b = new N2N({
      socket
    })
    return new Promise((resolve, reject) => {
      a.connect(b).then(() => {
        assert.strictEqual(a.getNeighboursIds().length, 1)
        assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
        assert.strictEqual(b.getNeighboursIds().length, 0)
        resolve()
      }).catch(e => {
        reject(e)
      })
    })
  })

  it('offline connection send function', async () => {
    const a = new N2N({
      socket
    })
    const b = new N2N({
      socket
    })
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
    return new Promise((resolve, reject) => {
      a.send('receive', b.id, 'miaou').then(() => {
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
        b.send('receive', a.id, 'reply')
      })
    })
  })

  it('offline connection, check inview/outview', async () => {
    const a = new N2N({
      socket
    })
    const b = new N2N({
      socket
    })
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 2)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 3)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 4)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 5)
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
      socket
    })
    const b = new N2N({
      socket
    })
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 2)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 3)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 4)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 5)
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
  it('offline connection+disconnection a need to be at 0/1 and b at 1/0 (outview/inview)', async () => {
    const a = new N2N({
      socket
    })
    const b = new N2N({
      socket
    })
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 2)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 3)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 4)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 5)
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

  it('offline connection+disconnection, a: 0/0 b: 0/0', async () => {
    const a = new N2N({
      socket
    })
    const b = new N2N({
      socket
    })
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 1)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 2)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 3)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 4)
    await a.connect(b)
    assert.strictEqual(a.view.livingOutview.get(b.id).occurences, 5)
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
    await utils.timeout(1000)
    assert.strictEqual(a.getNeighboursIds().length, 0)
    assert.strictEqual(b.getNeighboursIds().length, 0)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 0)
    assert.strictEqual(b.view.livingInview.size, 0)
    assert.strictEqual(b.view.livingOutview.size, 0)
  })
  it('offline connection+disconnection, bridge must work in the perfect world', async () => {
    const a = new N2N({
      socket
    })
    const b = new N2N({
      socket
    })
    const c = new N2N({
      socket
    })
    await a.connect(b)
    await utils.timeout(500)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 0)
    await b.connect(c)
    await utils.timeout(500)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 1)
    assert.strictEqual(c.view.livingInview.size, 1)
    assert.strictEqual(c.view.livingOutview.size, 0)
    await b.connect4u(a.id, c.id)
    await utils.timeout(500)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 2)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 1)
    assert.strictEqual(c.view.livingInview.size, 2)
    assert.strictEqual(c.view.livingOutview.size, 0)
  })
  it('offline connection+disconnection, bridge cannot work with a conenction locked on dest', async () => {
    const a = new N2N({
      socket
    })
    const b = new N2N({
      socket
    })
    const c = new N2N({
      socket
    })
    await a.connect(b)
    assert.strictEqual(a.view.livingInview.size, 0)
    assert.strictEqual(a.view.livingOutview.size, 1)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 0)
    await b.connect(c)
    assert.strictEqual(b.view.livingInview.size, 1)
    assert.strictEqual(b.view.livingOutview.size, 1)
    assert.strictEqual(c.view.livingInview.size, 1)
    assert.strictEqual(c.view.livingOutview.size, 0)
    b.view.lock(c.id)
    return b.connect4u(c.id, a.id).catch(e => {
      console.error(e)
      return Promise.resolve()
    })
  })
}) // end describe
