const Socket = require('../api').socket
const lmerge = require('lodash.merge')
const short = require('short-uuid')
const translator = short()

/**
 * @class
 * @classdesc Simple-peer wrapper implementing the Socket API
 * @extends Socket
 */
class SimplePeerWrapper extends Socket {
  constructor (options, signaling) {
    options = lmerge({
      trickle: true,
      initiator: true,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }] // default simple peer iceServers...
      }
    }, options)
    super(options, signaling)
    this._debug('Socket options set: ', options)

    this.SimplePeer = (require('simple-peer'))
    this._socket = undefined
    this.signaling.events.on('receive_offer', (initiator, { jobId, offer }) => {
      if (initiator === this.options.remoteId) {
        this.events.emit(`receive_new_offer-${jobId}`, offer)
      }
    })

    this.signaling.events.on('receive_accepted_offer', (initiator, { jobId, offer }) => {
      if (initiator === this.options.remoteId) {
        this.events.emit(`receive_accepted_offer-${jobId}`, offer)
      }
    })
  }

  _connect (options = this.options.socket) {
    return new Promise(async (resolve, reject) => {
      let jobId = translator.new()
      this._socket = new (this.SimplePeer)(options)
      this._socket.on('connect', () => {
        resolve()
      })
      this._socket.on('signal', (offer) => {
        this.signaling.sendOffer(this.options.localId, this.options.remoteId, { jobId, offer })
      })
      this.events.on(`receive_new_offer-${jobId}`, offer => {
        this._socket.signal(offer)
      })
      this.events.on(`receive_new_offer-${jobId}`, offer => {
        this._socket.signal(offer)
      })
      this._socket.on('error', this._manageErrors)
      this._socket.on('data', this._receiveData)
    })
  }

  _manageErrors (...args) {
    console.error(...args)
    this.events.emit('error', ...args)
  }

  async _send (data) {
    try {
      this._socket.send(data)
      return Promise.Resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }

  async destroy () {
    try {
      this._socket.destroy()
      return Promise.Resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

module.exports = SimplePeerWrapper
