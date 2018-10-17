const SignalingAPI = require('../api').signaling
const events = require('../events')
const io = require('socket.io-client')
const short = require('short-uuid')
const translator = short()

class OnlineSignaling extends SignalingAPI {
  /**
   * @description Connect the signaling service to a Socket.io signaling server (see the server in ./server)
   * @param  {Object}  options options for the connection if needed
   * @return {Promise}            Promise resolved when the connection succeeded
   */
  connect (room = 'default', options = this.options) {
    if (this.socket) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const address = `${options.host}:${options.port}`
      const socket = io(address, {
        autoConnect: false,
        query: {
          room,
          id: options.id
        }
      })
      socket.connect()
      socket.once('connect', () => {
        this._initializeSocket(socket)
        resolve()
      })
      socket.once('connect_error', (error) => {
        socket.close()
        console.error('Signaling server connect_error: ', error)
        socket.off('connect')
        socket.off('connect_failed')
        socket.off('connect_timeout')
        reject(error)
      })
      socket.once('connect_failed', (error) => {
        socket.close()
        console.error('Signaling server connect_failed: ', error)
        socket.off('connect')
        socket.off('connect_failed')
        socket.off('connect_timeout')
        reject(error)
      })
      socket.once('connect_timeout', (timeout) => {
        socket.close()
        console.error('Signaling server connect_timeout: ', timeout)
        socket.off('connect')
        socket.off('connect_failed')
        socket.off('connect_error')
        reject(timeout)
      })
    })
  }

  _initializeSocket (socket) {
    this.socket = socket
    this.on(events.signaling.EMIT_OFFER, (offer) => {
      socket.emit('offer', offer)
    })
    socket.on('offer', (offer) => {
      this.emit(events.signaling.RECEIVE_OFFER, offer)
    })
    socket.on('error', (error) => {
      console.error('SS error: ', error)
    })
    socket.on('disconnect', (error) => {
      console.log('SS disconnection: ', error)
    })
    socket.on('reconnect_error', (error) => {
      socket.close()
      console.error('SS disconnection: ', error)
    })
    socket.on('reconnect_failed', (error) => {
      socket.close()
      console.error('SS disconenction: ', error)
    })
    socket.on('reconnect_attempt', () => {
      console.log('SS attempting a reconnection')
    })
    socket.on('reconnect', (number) => {
      console.log('SS successfull reconnection when attempting a reconnection: ', number)
    })
  }

  /**
   * Get a new peer from the signaling service, can be undefined or a string representing the peer id to connect with
   * @return {Promise}        Promise resolved with the peerId or undefined as result or reject with an error
   */
  getNewPeer () {
    return new Promise((resolve, reject) => {
      const jobId = translator.new()
      this.socket.emit('getNewPeer', jobId)
      this.socket.once(jobId, (peerId) => {
        resolve(peerId)
      })
    })
  }

  /**
   * Send an offer to the signaling service
   * @param  {Object}  offer  the offer to send to the signaling server
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async sendOffer (offer) {
    this.socket.emit('offer', offer)
  }
} // not implemented for the moment

module.exports = OnlineSignaling
