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
      moc: false,
      MocClass: require('./webrtc-moc'),
      trickle: true,
      initiator: false,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }] // default simple peer iceServers...
      }
    }, options)
    super(options)
    this.socketId = translator.new()
    this.statistics = {
      offerSent: 0,
      offerReceived: 0
    }
  }

  _receiveOffer (offer) {
    this.statistics.offerReceived++
    this._debug('[socket:%s] the socket just received an offer', this.socketId, this.statistics, this.options.initiator, offer)
    this._create()
    this.__socket.signal(offer)
  }
  _create (options = this.options) {
    options.initiator = false
    if (!this.__socket) {
      if (this.options.moc) {
        this.__socket = new this.options.MocClass(options)
      } else {
        this.__socket = new SimplePeer(options)
      }
      this._debug('Simple-peer Socket options set: ', options)
      this.__socket.on('connect', () => {
        this.emit('connect')
      })
      this.__socket.on('signal', (offer) => {
        this.statistics.offerSent++
        this._debug('[socket:%s] Send an accepted offer: ', this.socketId, this.statistics, offer)
        this.emitOffer(offer)
      })
      this.__socket.on('close', () => {
        this._debug('socket closed.')
        this.emit('close')
      })
      this.__socket.on('error', (error) => {
        this.__socket.destroy()
        this._manageErrors(error)
      })
      this.__socket.on('data', (...args) => {
        this._debug('[socket:%s] receiving data...', this.socketId, ...args)
        this._receiveData(...args)
      })
    }
  }

  _connect (options = this.options.socket) {
    options.initiator = true
    this._debug('Options for the new socket: ', options)
    return new Promise(async (resolve, reject) => {
      if (options.moc) {
        this.__socket = new this.options.MocClass(options)
      } else {
        this.__socket = new SimplePeer(options)
      }
      this.__socket.on('signal', (offer) => {
        this.statistics.offerSent++
        this.emitOffer(offer)
      })
      this.__socket.on('connect', () => {
        resolve()
      })
      this.__socket.on('error', (error) => {
        this.__socket.destroy()
        this._manageErrors(error)
      })
      this.__socket.on('data', (...args) => {
        this._receiveData(...args)
      })
      this.__socket.on('close', () => {
        this._debug('socket closed.')
        this.emit('close')
      })
    })
  }

  _manageErrors (...args) {
    this._debug('Error on the socket: ', ...args)
    this.emit('error', ...args)
  }

  async _send (data) {
    this._debug('sending data: ', data)
    this._create()
    this.__socket.send(data)
  }

  async _disconnect () {
    try {
      this.__socket.destroy()
      return Promise.resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

module.exports = SimplePeerWrapper
