const errors = require('../errors')
const events = require('../events')
const EventEmitter = require('events')
const sizeof = require('object-sizeof')
const lmerge = require('lodash.merge')
const short = require('short-uuid')
const translator = short()

/**
 * @class
 * @classdesc This Abstract class represent a socket which can be implemented with any socket compatible with this API.
 * For example you can implement this class with a webrtc socket such as simple-peer
 * @type {class}
 */
class Socket extends EventEmitter {
  /**
   * @description Constructor of the Socket class, the connect method just initialize a socket and wait for an accepted offer
   * @param {Object} options   any options needed
   */
  constructor (options = {}) {
    super()
    this.socketId = translator.new()
    this._debug = (require('debug'))('n2n:socket')
    this._debugMessage = (require('debug'))('n2n:message')
    this.options = lmerge({ chunks: 16000 }, options)
    this.status = 'disconnected' // connected or disconnected
    this.on(events.socket.RECEIVE_OFFER, this._receiveOffer)
    this.buffer = []
    this.statistics = {
      offerSent: 0,
      offerReceived: 0
    }
  }

  /**
   * Review the buffer of data sent
   * @return {void}
   */
  reviewBuffer () {
    let data
    while ((data = this.buffer.shift())) {
      this.send(data)
    }
  }

  /**
   * Signal to the supervisor of the socket that this socket is conencted and review the internal buffer
   * @return {void}
   */
  signalConnect () {
    this.status = 'connected'
    this.emit('connect')
    this.reviewBuffer()
  }

  /**
   * Signal to the supervisor of the socket that this socket is disconnected
   * @return {void}
   */
  signalDisconnect () {
    if (this.status === 'connected') {
      this.status = 'disconnected'
      this.emit('close')
    }
  }

  /**
   * @description To Implement: you will receive all offers here, do what you want with them, Usefull for connection if you are using simple-peer or webrtc
   * @param  {Object} offer offer received from someone who want to connect to us
   * @return {void}
   */
  _receiveOffer (offer) {
    throw errors.nyi()
  }

  /**
   * Send an offer to the supervisor of the socket for sending the offer (perhaps used by a signaling service)
   * @param  {Object} offer [description]
   * @return {void}       [description]
   */
  emitOffer (offer) {
    this.statistics.offerSent++
    this._debug('[socket:%s] Send an accepted offer (status=%s): ', this.socketId, this.status, offer, this.statistics)
    if (this.status === 'connected') {
      console.log('The socket is connected but you continue to emit offers...', offer, this.status, this.__socket._channel.readyState)
      this.emit(events.socket.EMIT_OFFER_RENEGOCIATE, offer)
    } else {
      this.emit(events.socket.EMIT_OFFER, offer)
    }
  }

  /**
   * @description [**To implement**]
   * Connect the socket to a peer you have to provide.
   * You have to implement this method and return a promise that resolve when the connection is completed.
   * @param  {Object} options options passed to the function
   * @return {Promise}         Promise resolved when the socket is connected
   */
  _connect (options) {
    return Promise.reject(errors.nyi())
  }

  /**
   * @description [**To implement**]
   * Send a message on the socket to the peer which is connected to this socket.
   * You have to implement this method and return a promise that resolve when the message is sent
   * @param  {Object} data    data to send
   * @param  {Object} options options
   * @return {Promise}         Promise resolved when the message is sent
   */
  _send (data, options) {
    return Promise.reject(errors.nyi())
  }

  /**
   * Callback called when data are received
   * Default bbehavior: emit data on the event bus when received with the event 'data'
   * @param  {Object} data data received
   * @return {void}
   */
  _receiveData (data) {
    if (this.status === 'connecting') {
      this.signalConnect()
    }
    this._debug('[socket:%s] receiving data, size=%f', this.socketId, sizeof(data))
    this.emit('data', data)
  }

  _manageErrors (...args) {
    this._debug('Error on the socket: ', ...args)
    this.emit('error', ...args)
  }

  /**
   * @description [**To implement**]
   * Destroy/disconnect the socket
   * You have to implement this method and return a promise that resolve when the socket is destroyed
   * @return {Promise} Promise resolved when the socket is destroyed/disconnected
   */
  _disconnect () {
    return Promise.reject(errors.nyi())
  }

  /**
  * @description Connect the socket to a peer using the signaling service provided by the supervisor of the socket.
  * @param  {Object} options options passed to the function
  * @return {Promise}         Promise resolved when the socket is connected
   */
  async connect (options = this.options) {
    this.status = 'connecting'
    return this._connect(options).then((res) => {
      this.signalConnect()
      return res
    }).catch(e => e)
  }

  /**
   * @description Send a message on the socket to the peer which is connected to this socket.
   * @param  {Object} data    data to send
   * @param  {Object} options options
   * @return {Promise}         Promise resolved when the message is sent
   */
  async send (data, options) {
    const size = sizeof(data)
    this._debug('[socket:%s] Data size sent (max allowed=%f Bytes): %f', this.socketId, this.options.chunks, size)
    if (size > this.options.chunks) {
      return Promise.reject(new Error('Your data is too big. Max allowed: ' + this.options.chunks))
    } else {
      if (this.status === 'connected') {
        return this._send(data, options)
      } else if (this.status === 'connecting') {
        this.buffer.push(data)
      } else if (this.status === 'disconnected') {
        throw new Error('socket disconnected.')
      }
    }
  }

  /**
   * @description Destroy/disconnect the socket
   * @return {Promise} Promise resolved when the socket is destroyed/disconnected
   */
  async disconnect (options) {
    this.status = 'disconnected'
    return this._disconnect(options).then((res) => {
      this.status = 'disconnected'
      return res
    }).catch(e => e)
  }
}

module.exports = Socket
