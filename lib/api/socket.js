const errors = require('../errors')

module.exports = class Socket {
  constructor(options, signaling) {
    this._debug = (require('debug'))('n2n:socket')
    this.options = options
    this.status = 'disconnected' // connected or disconnected
  }

  _connect (options) {
    return Promise.reject(errors.nyi())
  }

  _send (data, options) {
    return Promise.reject(errors.nyi())
  }

  _destroy() {
    return Promise.reject(errors.nyi())
  }

  async connect (options) {
    return this._connect(options).then((res) => {
      this.status = 'connected'
      this._debug('status: connected')
      return res
    }).catch(e => e)
  }

  async send (data, options) {
    return this._send(data, options).then((res) => {
      this._debug('message sent')
      return res
    }).catch(e => e)
  }

  async destroy(options) {
    return this._destroy(options).then((res) => {
      this._debug('socket destroy')
      return res
    }).catch(e => e)
  }
}
