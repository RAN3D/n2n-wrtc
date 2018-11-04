const EventEmitter = require('events')
const lmerge = require('lodash.merge')
const short = require('short-uuid')
const translator = short()
const debug = require('debug')
const debugManager = debug('spa')

const DEFAULT_OPTIONS = () => {
  return {
    id: translator.new(),
    initiator: false
  }
}

/**
 * Simple-Peer Moc Manager
 * @private
 */
class Manager {
  /**
   * @private
   */
  constructor () {
    this._statistics = {
      message: 0
    }
    this.manager = new Map()
    this._options = {
      latency: (send) => { setTimeout(send, 0) }
    }
    debugManager('manager initialized')
  }
  // @private
  get stats () {
    return this._statistics
  }
  // @private
  set (peerId, peer) {
    if (this.manager.has(peerId)) {
      throw new Error('this peer already exsists: ' + peerId)
    }
    this.manager.set(peerId, peer)
  }
  // @private
  connect (from, to) {
    debugManager('peer connected from/to: ', from, to)
    this.manager.get(to)._connectWith(from)
    this.manager.get(from)._connectWith(to)
  }
  // @private
  destroy (from, to) {
    debugManager('peer disconnected from/to: ', from, to)
    if (this.manager.get(from)) {
      this.manager.get(from)._close()
    }
    if (this.manager.get(to)) {
      this.manager.get(to)._close()
    }
  }
  // @private
  send (from, to, msg, retry = 0) {
    this._send(from, to, msg, retry)
  }
  // @private
  _send (from, to, msg, retry = 0) {
    try {
      if (!this.manager.has(from) || !this.manager.has(to)) throw new Error('need a (from) and (to) peer.')
      this.manager.get(to).emit('data', msg)
      this._statistics.message++
    } catch (e) {
      throw new Error('cannot send the message. perhaps your destination is not reachable.', e)
    }
  }
}
const manager = new Manager()

/**
 * Simple Peer Moc,
 * @private
 */
module.exports = class SimplePeerAbstract extends EventEmitter {
  /**
   * @private
   */
  constructor (options) {
    super()
    this._manager = manager
    this._options = lmerge(DEFAULT_OPTIONS(), options)
    this.id = this._options.id
    this._isNegotiating = false
    this.connected = false
    this.disconnected = false
    this.connectedWith = undefined
    this.__initiated = false
    this.messageBuffer = []
    debugManager('peer initiated:', this.id, this._options.initiator)
    if (this._options.initiator) {
      // workaround to wait for a listener on 'signal'
      process.nextTick(() => {
        this._init()
      })
    }
    this._manager.set(this.id, this)
    this.on('internal_close', () => {
      this._manager.manager.delete(this.id)
    })
  }
  // @private
  static get manager () {
    return manager
  }
  send (data) {
    if (!this.connectedWith) {
      this.messageBuffer.push(data)
    } else {
      if (this.messageBuffer.length > 0) {
        this._reviewMessageBuffer()
      }
      if (this.connectedWith) {
        this._send(this.connectedWith, data)
      } else {
        this.messageBuffer.push(data)
      }
    }
  }
  destroy () {
    this._manager.destroy(this.id, this.connectedWith)
  }
  signal (data) {
    if (data.type === 'accept') {
      debugManager('offer-accept received:', data)
      this._connect(data)
    } else if (data.type === 'init') {
      this._isNegotiating = true
      debugManager('offer-init received:', data)
      this.emit('signal', this._createAccept(data))
    }
  }
  // @private
  _error (error) {
    debugManager(error)
    this.emit('internal_close')
    this.emit('error', error)
  }
  // @private
  _close () {
    this.emit('internal_close')
    debugManager('[%s] is closed.', this.id)
    this.emit('close')
  }
  // @private
  _init () {
    this._isNegotiating = true
    const offer = this._createOffer()
    offer.count = 1
    this.emit('signal', offer)
  }
  // @private
  _createOffer () {
    const newOffer = {
      offerId: translator.new(),
      type: 'init',
      offer: {
        initiator: this.id
      }
    }
    return newOffer
  }
  // @private
  _createAccept (offer) {
    const acceptedOffer = this._createOffer()
    acceptedOffer.type = 'accept'
    acceptedOffer.offerId = offer.offerId
    acceptedOffer.offer.initiator = offer.offer.initiator
    acceptedOffer.offer.acceptor = this.id
    acceptedOffer.count = offer.count
    return acceptedOffer
  }
  // @private
  _reviewMessageBuffer () {
    debugManager('Review the buffer: ', this.messageBuffer.length)
    while (this.connectedWith && this.messageBuffer.length !== 0) {
      this._send(this.messageBuffer.pop())
    }
  }
  // @private
  _send (to = this.connectedWith, data) {
    if (!to) throw new Error('It must have a destination.')
    this._manager.send(this.id, to, data)
  }
  // @private
  _connect (offer) {
    if (!offer.offer.acceptor) throw new Error('It must have an acceptor')
    this._manager.connect(offer.offer.initiator, offer.offer.acceptor)
  }
  // @private
  _connectWith (connectedWith) {
    this.connected = true
    this._isNegotiating = false
    this.connectedWith = connectedWith
    this.emit('connect')
  }
}
