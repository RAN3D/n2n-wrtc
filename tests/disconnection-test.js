const Neighborhood = require('../lib').Neighborhood
const wrtc = require('wrtc')
const assert = require('assert')

describe('Disconnection', function () {
  this.timeout(2 * 60 * 1000)
  it('disconnection after offline conenction', async () => {
    const a = new Neighborhood({
      neighborhood: {
        id: 'a'
      },
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new Neighborhood({
      neighborhood: {
        id: 'b'
      },
      socket: {
        trickle: true,
        wrtc
      }
    })
    const neigh = await a.connect(b)
    assert.strictEqual(neigh, b.id)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 1)
    return new Promise((resolve, reject) => {
      a.disconnect().then(async () => {
        const aneigh = a.getNeighbours()
        aneigh.forEach(p => {
          assert.strictEqual(p.status, 'disconnected')
        })
        b.on('close', (id) => {
          assert.strictEqual(id, a.id)
          assert.strictEqual(b.getNeighboursIds().length, 0)
          resolve()
        })
        assert.strictEqual(a.getNeighboursIds().length, 0)
        assert.strictEqual(b.getNeighboursIds().length, 1) // we are at one because the socket did not noticed yet that the channel is closed.
      }).catch(reject)
    })
  })
})
