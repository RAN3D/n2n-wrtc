const Neighborhood = require('../lib').Neighborhood
const assert = require('assert')
const utils = require('../lib/utils')

let ss
describe('[Neighborhood] Online connection', function () {
  this.timeout(2 * 60 * 1000)
  before((done) => {
    utils.startServer().then(signaling => {
      ss = signaling
      console.log('SS started.')
      done()
    })
  })
  after(() => {
    utils.stopServer(ss)
  })
  it('sending a message on an onlined connection need to be successfull', async () => {
    const a = new Neighborhood({
      signaling: {
        room: 'test'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const b = new Neighborhood({
      signaling: {
        room: 'test'
      },
      socket: {
        trickle: true,
        moc: true
      }
    })
    const neigh = await a.connect()
    assert.strictEqual(neigh, null)
    const neigh2 = await b.connect()
    assert.strictEqual(neigh2, a.id)
    assert.strictEqual(a.getNeighboursIds().length, 0) // inview 0
    assert.strictEqual(b.getNeighboursIds().length, 1) // outview 1
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
