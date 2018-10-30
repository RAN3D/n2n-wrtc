const Socket = require('./socket')
const lmerge = require('lodash.merge')
const SimplePeer = require('simple-peer')

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
  }

  _receiveOffer (offer) {
    this.statistics.offerReceived++
    this._debug('[socket:%s] the socket just received an offer (status=%s)', this.socketId, this.status, this.statistics, this.options.initiator, offer)
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
      this.status = 'connecting'
      this.__socket.once('connect', () => {
        this.signalConnect()
      })
      this.__socket.on('signal', (offer) => {
        this.emitOffer(offer)
      })
      this.__socket.on('close', () => {
        if (this.status !== 'disconnected') {
          this.signalDisconnect()
        }
      })
      this.__socket.on('error', (error) => {
        // this.signalDisconnect()
        this.__socket.destroy(error)
        this._manageErrors(error)
      })
      this.__socket.on('data', (...args) => {
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
        this.emitOffer(offer)
      })
      this.__socket.once('connect', () => {
        this.signalConnect()
        resolve()
      })
      this.__socket.once('error', (error) => {
        // this.signalDisconnect()
        this.__socket.destroy(error)
        this._manageErrors(error)
      })
      this.__socket.on('data', (...args) => {
        this._receiveData(...args)
      })
      this.__socket.once('close', () => {
        if (this.status !== 'disconnected') {
          this.signalDisconnect()
        }
      })
    })
  }

  async _send (data) {
    this._create()
    try {
      this.__socket.send(data)
    } catch (e) {
      throw e
    }
  }

  async _disconnect () {
    return new Promise((resolve, reject) => {
      this.__socket.once('close', () => {
        resolve()
      })
      this.__socket.destroy()
    })
  }
}

module.exports = SimplePeerWrapper
