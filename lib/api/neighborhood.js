const errors = require('../errors')
const EventEmitter = require('events')

class Neighborhood extends EventEmitter {
  constructor (options) {
    super()
    this._debug = (require('debug'))('n2n:neighborhood')
    this.options = options
    this.livingInview = new Map()
    this.livingOutview = new Map()
  }

  receiveData (id, data) {
    this.emit('receive', id, data)
  }

  async connect (options) {
    return Promise.reject(errors.nyi())
  }

  async send (peerId, message) {
    return Promise.reject(errors.nyi())
  }

  async disconnect (options) {
    return Promise.reject(errors.nyi())
  }

  getNeighbours () {
    return this.getNeighboursOutview()
  }

  getNeighboursIds () {
    return this.getNeighboursOutview().map(p => p.id)
  }

  getNeighboursOutview () {
    const res = []
    this.livingOutview.forEach((peer, id) => {
      if (peer.occurences >= 1) res.push({ peer, id })
    })
    return res
  }
  getNeighboursInview () {
    const res = []
    this.livingInview.forEach((peer, id) => {
      if (peer.occurences >= 1) res.push({ peer, id })
    })
    return res
  }
}

module.exports = Neighborhood
