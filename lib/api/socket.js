const errors = require('../errors')
const events = require('../events')
const EventEmitter = require('events')

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
    this._debug = (require('debug'))('n2n:socket')
    this.options = options
    this.status = 'disconnected' // connected or disconnected
    this.buffer = []
    this.on('connect', () => {
      this._debug('status: connected')
      this.status = 'connected'
      this.__reviewBuffer()
    })
    this.on(events.socket.RECEIVE_OFFER, this._receiveOffer)
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
    this.emit(events.socket.EMIT_OFFER, offer)
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
    this.emit('data', data)
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
    return this._connect(options).then((res) => {
      this.emit('connect')
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
    if (this.status !== 'connected') {
      this._debug('Message buffered...')
      this.buffer.push({ data, options })
      return Promise.resolve()
    } else {
      return this.__reviewBuffer().then(() => {
        return this._send(data, options)
      }).catch(e => {
        this._debug('Try to directly send the message: ', data, ' after: ', e)
        return this._send(data, options)
      })
    }
  }

  /**
   * @description Destroy/disconnect the socket
   * @return {Promise} Promise resolved when the socket is destroyed/disconnected
   */
  async disconnect (options) {
    return this._disconnect(options).then((res) => {
      this.status = 'disconnected'
      return res
    }).catch(e => e)
  }

  /**
   * @description Review the internal message buffer and return an error when an error occured
   * Emit an error the events bus (.events) with the signal 'error_message' with the error and the message we tried to send.
   * @return {Promise} Promise resolved messages are sent
   */
  async __reviewBuffer () {
    if (this.status !== 'connected') {
      return Promise.Resolve()
    } else {
      if (this.buffer.length > 0) {
        const data = this.buffer.shift()
        try {
          await this._send(data.data, data.options)
        } catch (e) {
          console.error('Cannot send the following message: ', e)
          this._events.emit('error_message', e, data)
        }
        return this.__reviewBuffer()
      } else {
        return Promise.resolve()
      }
    }
  }
}

module.exports = Socket
