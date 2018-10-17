const Neighborhood = require('../lib').Neighborhood
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
        moc: true
      }
    })
    const b = new Neighborhood({
      neighborhood: {
        id: 'b'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    a.on('connect', (id) => {
      console.log('A is connected to:', id)
    })
    b.on('connect', (id) => {
      console.log('B is connected to:', id)
    })
    const neigh = await a.connect(b)
    assert.strictEqual(neigh, b.id)
    assert.strictEqual(a.getNeighboursIds().length, 1)
    assert.strictEqual(b.getNeighboursIds().length, 0)
    // we ccan only have 0 neighbour in B becasue it is an inview socket
    return new Promise((resolve, reject) => {
      b.disconnect().catch(() => {
        a.disconnect().then(async () => {
          a.on('close', (id) => {
            assert.strictEqual(id, b.id)
            assert.strictEqual(a.getNeighboursIds().length, 0)
            assert.strictEqual(b.getNeighboursIds().length, 0)
            resolve()
          })
          assert.strictEqual(a.getNeighboursIds().length, 0)
          assert.strictEqual(b.getNeighboursIds().length, 0)
        }).catch(e => {
          reject(e)
        })
      })
    })
  })
})
