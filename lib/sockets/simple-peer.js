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
      this._debug('[socket:%s] Send an accepted offer: ', this.socketId, this.statistics, offer)
      this.emitOffer(offer)
    })
    this._socket.on('close', () => {
      this._debug('socket closed.')
      this.emit('close')
    })
    this._socket.on('error', (error) => {
      this._manageErrors(error)
    })
    this._socket.on('data', (...args) => {
      this._debug('[socket:%s] receiving data...', this.socketId, ...args)
      this._receiveData(...args)
    })

    this.statistics = {
      offerSent: 0,
      offerReceived: 0
    }
  }

  _receiveOffer (offer) {
    this.statistics.offerReceived++
    this._debug('[socket:%s] the socket just received an offer', this.socketId, this.statistics, this.options.initiator)
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
      this._socket.on('close', () => {
        this._debug('socket closed.')
        this.emit('close')
      })
    })
  }

  _manageErrors (...args) {
    this.emit('error', ...args)
  }

  async _send (data) {
    this._debug('sending data: ', data)
    try {
      this._socket.send(data)
      return Promise.resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }

  async _disconnect () {
    try {
      this._socket.destroy()
      return Promise.resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

module.exports = SimplePeerWrapper
