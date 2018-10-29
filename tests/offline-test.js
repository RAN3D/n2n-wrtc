const N2N = require('../lib').N2N
const assert = require('assert')

describe('[N2N] Offline connection', function () {
  this.timeout(10 * 1000)
  it('sending a message on an offlined connection need to be successfull', async () => {
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
    a.on('out', (id) => {
      console.log('a connected to b')
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
    return new Promise((resolve, reject) => {
      a.on('receive', (id, message) => {
        assert.strictEqual(message, 'reply')
        resolve()
      })
      b.on('receive', (id, data) => {
        console.log('[test] receive: ', id, data)
        assert.strictEqual(data, 'miaou')
        b.send('receive', a.id, 'reply', false)
      })
      a.send('receive', b.id, 'miaou', true).then(() => {
        console.log('[test] message sent.')
      }).catch(e => {
        reject(e)
      })
    })
  })
})
