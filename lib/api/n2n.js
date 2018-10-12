const EventEmitter = require('events')
const errors = require('../errors')

class AbstractN2N extends EventEmitter {
  constructor (options) {
    super()
    this.options = options
    this._debug = (require('debug'))('n2n:n2n')
  }

  /**
   * Connect an instance of N2N to another N2N instance or use a signaling service
   * @param  {AbstractN2N}  n2n N2N instance
   * @return {Promise}     Resolved whent the connection is successfully established
   */
  async connect (n2n) {
    return Promise.reject(errors.nyi())
  }

  async disconnect (peerId) {
    return Promise.reject(errors.nyi())
  }

  async connectFromUs (peerId) {
    return Promise.reject(errors.nyi())
  }

  async connectToUs (peerId) {
    return Promise.reject(errors.nyi())
  }

  async connectBridge (peerId) {
    return Promise.reject(errors.nyi())
  }

  async send (id, msg) {
    return Promise.reject(errors.nyi())
  }

  getNeighboursInview () {
    throw errors.nyi()
  }

  getNeighboursOutview () {
    throw errors.nyi()
  }

  getNeighbours () {
    throw errors.nyi()
  }

  getNeighboursIds () {
    throw errors.nyi()
  }
}

module.exports = AbstractN2N
