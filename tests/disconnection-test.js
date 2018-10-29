const N2N = require('../lib').N2N
const assert = require('assert')

describe('N2N', function () {
  this.timeout(2 * 60 * 1000)
  it('disconnection after offline conenction', async () => {
    const a = new N2N({
      neighborhood: {
        id: 'a'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const b = new N2N({
      neighborhood: {
        id: 'b'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    a.on('out', (id) => {
      console.log('A is connected to:', id)
    })
    b.on('out', (id) => {
      console.log('B is connected to:', id)
    })
    a.on('close_out', () => {
      console.log('A closes an outview arc')
    })
    a.on('close_in', () => {
      console.log('someone closes an inview arc of A')
    })
    b.on('close_out', () => {
      console.log('B closes an outview arc')
    })
    b.on('close_in', () => {
      console.log('someone closes an inview arc of B')
    })
    const neigh = await a.connect(b)
    assert.strictEqual(neigh, b.id)
    // we ccan only have 0 neighbour in B becasue it is an inview socket
    return new Promise((resolve, reject) => {
      a.on('close', (id) => {
        console.log('a close ', id)
        assert.strictEqual(id, b.id)
        assert.strictEqual(a.getNeighboursIds().length, 0)
        assert.strictEqual(b.getNeighboursIds().length, 0)
        // resolve()
      })
      b.disconnect(a.id).catch(e => {
        console.log('b is disconnected', e)
        a.disconnect().then(() => {
          resolve()
        })
      })
    })
  })
})
