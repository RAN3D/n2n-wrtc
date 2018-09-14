const errors = require('../errors')

class Neighborhood {
  constructor (options) {
    this._debug = (require('debug'))('n2n:neighborhood')
    this.options = options
    this.living = new Map()
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
}

module.exports = Neighborhood
