const SignalingAPI = require('./signaling')
const events = require('../events')
const io = require('socket.io-client')
const short = require('short-uuid')
const translator = short()

class OnlineSignaling extends SignalingAPI {
  constructor (options, n2n) {
    super(options)
    this.parent = n2n
    this.on(events.signaling.RECEIVE_OFFER, ({ jobId, initiator, destination, type, offer }) => {
      if (!initiator || !destination || !offer || !type) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      if (!this.parent.livingInview.has(initiator) && type === 'new') {
        // we do have the socket for the moment, create it
        this.parent.createNewSocket(this.parent.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.parent.pendingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.sendOffer({
            initiator,
            destination,
            offer: socketOffer,
            type: 'back'
          })
        })
        this.parent.pendingInview.get(initiator).socket.on(events.socket.EMIT_OFFER_RENEGOCIATE, (socketOffer) => {
          console.log('[bridge] receive a negociate offer')
          const off = {
            jobId,
            initiator,
            destination,
            offer: socketOffer,
            offerType: 'back'
          }
          this.parent.signaling.direct.sendOfferBackRenegociate(off)
        })
        this.parent.pendingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (type === 'new') {
          // check if it is in pending or living
          if (this.parent.pendingInview.has(initiator)) {
            this.parent.pendingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } else if (this.parent.livingInview.has(initiator)) {
            this.parent.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          }
        } else if (type === 'back') {
          // check if it is in pending or living
          if (this.parent.pendingOutview.has(destination)) {
            this.parent.pendingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } else if (this.parent.livingOutview.has(destination)) {
            this.parent.livingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
          }
        }
      }
    })
  }
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
