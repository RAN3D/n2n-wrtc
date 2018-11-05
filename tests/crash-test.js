const N2N = require('../lib').N2N
const assert = require('assert')

describe('[N2N] Crash test', function () {
  this.timeout(10 * 1000)
  it('crash need to emit correct events', async () => {
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
      console.log('a is connected to b')
    })
    b.on('in', (id) => {
      console.log('b is connected to a')
    })
    await a.connect(b)
    await a.connect(b)
    await a.connect(b)
    return new Promise((resolve, reject) => {
      let o = 0
      const done = (occ) => {
        o += occ
        if (o === 6) {
          resolve()
        }
      }
      a.on('crash_out', (id, occurences, outview) => {
        try {
          console.log('a noticed that a peer has crash in its outview. %s', id, occurences)
          assert.strictEqual(outview, true)
          assert.strictEqual(occurences, 3)
          done(3)
        } catch (e) {
          reject(e)
        }
      })
      b.on('crash_in', (id, occurences, outview) => {
        try {
          console.log('b noticed that a peer has crash in its inview. %s', id, occurences)
          assert.strictEqual(outview, false)
          assert.strictEqual(occurences, 3)
          done(3)
        } catch (e) {
          reject(e)
        }
      })
      b.crash()
    })
  })
})
