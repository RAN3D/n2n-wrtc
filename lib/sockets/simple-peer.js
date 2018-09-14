const Socket = require('../api').socket
const lmerge = require('lodash.merge')
const SimplePeer = require('simple-peer')
const short = require('short-uuid')
const translator = short()

/**
 * @class
 * @classdesc Simple-peer wrapper implementing the Socket API
 * @extends Socket
 */
class SimplePeerWrapper extends Socket {
  constructor (options) {
    options = lmerge({
      trickle: true,
      initiator: false,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }] // default simple peer iceServers...
      }
    }, options)
    super(options)
    this.socketId = translator.new()
    this._socket = new SimplePeer(lmerge({ initiator: false }, options))
    this._debug('Simple-peer Socket options set: ', options)
    this._socket.on('connect', () => {
      this.emit('connect')
    })
    this._socket.on('signal', (offer) => {
      this.statistics.offerSent++
      console.log('Send an accepted offer: ', this.statistics)
      this.emitOffer(offer)
    })
    this._socket.on('error', (error) => {
      this._manageErrors(error)
    })
    this._socket.on('data', (...args) => {
      console.log('receiving data...', ...args)
      this._receiveData(...args)
    })

    this.statistics = {
      offerSent: 0,
      offerReceived: 0
    }
  }

  _receiveOffer (offer) {
    this.statistics.offerReceived++
    console.log(this.socketId, 'the socket just received an offer', this.statistics, this.options.initiator)
    this._socket.signal(offer)
  }

  _connect (options = this.options.socket) {
    options.initiator = true
    this._debug('Options for the new socket: ', options)
    return new Promise(async (resolve, reject) => {
      this._socket = new SimplePeer(options)
      this._socket.on('signal', (offer) => {
        this.statistics.offerSent++
        this.emitOffer(offer)
      })
      this._socket.on('connect', () => {
        resolve()
      })
      this._socket.on('error', (error) => {
        this._manageErrors(error)
      })
      this._socket.on('data', (...args) => {
        this._receiveData(...args)
      })
    })
  }

  _manageErrors (...args) {
    this.emit('error', ...args)
  }

  async _send (data) {
    console.log('sending data: ', data)
    try {
      this._socket.send(data)
      return Promise.resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }

  async _destroy () {
    try {
      this._socket.destroy()
      return Promise.resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

module.exports = SimplePeerWrapper
