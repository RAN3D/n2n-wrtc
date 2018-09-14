const Neighborhood = require('../lib').Neighborhood
console.log(Neighborhood)
const wrtc = require('wrtc')
const assert = require('assert')

describe('Test connection', function () {
  this.timeout(2 * 60 * 1000)
  it('connection need to be successfull using a direct connection', async () => {
    const a = new Neighborhood({
      neighborhood: {
        hello: 'world'
      },
      socket: {
        trickle: true,
        wrtc
      }
    })
    const b = new Neighborhood({
      neighborhood: {
        hello: 'world'
      },
      socket: {
        trickle: true,
        wrtc
      }
    })
    await a.connect(b)
    assert.strict.equal(a.getNeighboursIds().length, 1)
    assert.strict.equal(b.getNeighboursIds().length, 1)
    return new Promise((resolve, reject) => {
      a.send(b.id, 'miaou').then(() => {
        console.log('message sent.')
      }).catch(e => {
        reject(e)
      })
      b.on('receive', (id, data) => {
        console.log('receive: ', id, data)
        assert.strict.equal(data, 'miaou')
        resolve()
      })
    })
  })
})
