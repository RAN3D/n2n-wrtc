const errors = require('../errors')
const EventEmitter = require('events')

class Neighborhood extends EventEmitter {
  constructor (options) {
    super()
    this._debug = (require('debug'))('n2n:neighborhood')
    this.options = options
    this.living = new Map()
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
    return this.living
  }

  getNeighboursIds () {
    return [...this.living.keys()]
  }
}

module.exports = Neighborhood
