const Neighborhood = require('../lib').Neighborhood
const assert = require('assert')

describe('[Neighborhood] Offline connection', function () {
  this.timeout(2 * 60 * 1000)
  it('sending a message on an offlined connection need to be successfull', async () => {
    const a = new Neighborhood({
      socket: {
        trickle: true,
        moc: true
      }
    })
    const b = new Neighborhood({
      socket: {
        trickle: true,
        moc: true
      }
    })
    await a.connect(b)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 0)
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
})
