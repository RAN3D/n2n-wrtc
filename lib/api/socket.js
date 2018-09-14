const errors = require('../errors')
const lmerge = require('lodash.merge')
const short = require('short-uuid')
const translator = short()

/**
 * @class
 * @classdesc This Abstract class represent a socket which can be implemented with any socket compatible with this API.
 * For example you can implement this class with a webrtc socket such as simple-peer
 * @type {class}
 */
class Socket {
  /**
   * @description Constructor of the Socket class
   * @param {Object} options   any options needed
   * @param {Signaling} signaling a Signaling instance used to enable the entrance of the socket in a network
   */
  constructor (options = {}, signaling) {
    this.signaling = signaling
    this._debug = (require('debug'))('n2n:socket')
    this.events = new (require('events'))()
    this.options = lmerge({
      localId: translator.new(),
      remoteId: undefined
      // this is the id of the remote peer IT IS REQUIRED
    }, options)
    this._debug('Abstract Socket options set: ', this.options)
    if (!this.options.remoteId) throw new Error('we need the id of the remote peer') // REQUIRED
    this.status = 'disconnected' // connected or disconnected
    this.buffer = []
  }

  /**
   * @description [**To implement**]
   * Connect the socket to a peer using the signaling service provided in the constructor or by your own signaling service.
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
    this.events.emit('data')
  }

  /**
   * @description [**To implement**]
   * Destroy/disconnect the socket
   * You have to implement this method and return a promise that resolve when the socket is destroyed
   * @return {Promise} Promise resolved when the socket is destroyed/disconnected
   */
  _destroy () {
    return Promise.reject(errors.nyi())
  }

  /**
  * @description Connect the socket to a peer using the signaling service provided in the constructor or by your own signaling service.
  * @param  {Object} options options passed to the function
  * @return {Promise}         Promise resolved when the socket is connected
   */
  async connect (options) {
    return this._connect(options).then((res) => {
      this.status = 'connected'
      this._debug('status: connected')
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
  async destroy (options) {
    return this._destroy(options).then((res) => {
      this._debug('socket destroy')
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
