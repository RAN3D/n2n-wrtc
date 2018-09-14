const Neighborhood = require('../lib').Neighborhood
console.log(Neighborhood)
const wrtc = require('wrtc')

describe('Test connection', () => {
  it('connection need to be successfull using a direct connection', async () => {
    const a = new Neighborhood({
      neighborhood: {
        hello: 'world'
      },
      socket: {
        wrtc
      }
    })
    const b = new Neighborhood({
      neighborhood: {
        hello: 'world'
      },
      socket: {
        wrtc
      }
    })

    await a.connect(b)
  })
})
