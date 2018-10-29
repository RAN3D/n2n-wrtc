const SignalingAPI = require('../api').signaling
const events = require('../events')
const debug = require('debug')
const errors = require('../errors')
const short = require('short-uuid')
const translator = short()

class DirectSignaling extends SignalingAPI {
  constructor (options, n2n) {
    super(options)
    this.parent = n2n
    this._debug = debug('n2n:direct')
    this.on(events.signaling.RECEIVE_OFFER, ({ jobId, initiator, destination, offerType, offer }) => {
      this._debug('[%s][%s] receive an offer from %s: ', this.parent.id, jobId, initiator, offer)
      if (!initiator || !destination || !offer || !offerType) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      // do we have the initiator in our list of connections?
      if (!this.parent.pendingInview.has(initiator) && offerType === 'new') {
        // we do have the socket for the moment, create it
        this.parent.createNewSocket(this.parent.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.parent.pendingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          const off = {
            jobId,
            initiator,
            destination,
            offer: socketOffer,
            offerType: 'back'
          }
          this.sendOfferBack(off)
          // console.log('%s emitted accepted offers: ', jobId, off)
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
          this.sendOfferBackRenegociate(off)
        })
        // WE RECEIVE THE OFFER ON THE ACCEPTOR
        // console.log('[first/new] receive an offer to emit to the socket... ', jobId)
        this.parent.pendingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (offerType === 'new') {
          // check if it is in pending or living
          if (this.parent.pendingInview.has(initiator)) {
            this.parent.pendingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } else if (this.parent.livingInview.has(initiator)) {
            this.parent.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          }
        } else if (offerType === 'back') {
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
   * @description Connect.Just connect, oh wait? (-_-)
   * @param  {Object}  options options for the connection if needed
   * @return {Promise}            Promise resolved when the connection succeeded
   */
  async connect (options) {}
  /**
   * Send an offer to the forwarding peer
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async sendOfferTo (offer) {
    offer.type = events.n2n.DIRECT_TO
    this.parent.send(this.parent.options.n2n.protocol, offer.destination, offer, false).then(() => {
      this._debug('[%s] send to direct peer: %s', this.parent.id, offer.destination, offer)
    }).catch(e => {
      console.error('[%s] send to direct, error', this.parent.id, e)
    })
  }
  /**
   * Send back an accepted offer to the forwarding peer
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async sendOfferBack (offer) {
    offer.type = events.n2n.DIRECT_BACK
    this._debug('[%s] send back the offer to the direct peer: %s', this.parent.id, offer.initiator, offer)
    this.parent.send(this.parent.options.n2n.protocol, offer.initiator, offer).catch(e => {
      console.error('[%s] send back to direct, error', this.parent.id, e)
    })
  }
  /**
   * Send back an accepted offer to the forwarding peer (for renegociate )
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async sendOfferBackRenegociate (offer) {
    offer.type = events.n2n.DIRECT_BACK
    this._debug('[%s][RENEGOCIATE]send back the offer to the direct peer: %s', this.parent.id, offer.initiator, offer)
    this.parent.send(this.parent.options.n2n.protocol, offer.initiator, offer, false).catch(e => {
      console.error('[%s] send back to direct, error', this.parent.id, e)
    })
  }

  /**
   * Ask to the peer identified by peerId to establish a connection with us. It add an arc from its outview to our inview.
   * To not lock the connection forever the function will timeout after the timeout specified in the function (also in options)
   * So if the connection timed out and the connection is well established.
   * Good to luck to find a way to solve your problem. (set a bigger timeout (-_-))
   * @param  {String}  peerId id of the peer that will establish the connection
   * @return {Promise} Resolve when the connection is successfully established. Reject otherwise, error or timeout, or peer not found.
   */
  async connectToUs (peerId, timeout = this.parent.options.n2n.timeout) {
    if (!this.parent.livingOutview.has(peerId)) {
      throw errors.peerNotFound(peerId)
    } else {
      return new Promise((resolve, reject) => {
        // first send a message to peerId
        const jobId = translator.new()
        const tout = setTimeout(() => {
          reject(new Error('connectToUs: timeout | peerId: ' + peerId + ' jobId: ' + jobId))
        }, timeout + 1000) // always put two second to handle a maximum of 2s of delay minimum...
        this.parent.events.once(jobId, (msg) => {
          if (msg.response) {
            clearTimeout(tout)
            resolve()
          } else {
            clearTimeout(tout)
            // means no
            reject(new Error('Connection could be established. Something wrong happened. Reason: ' + msg.reason))
          }
        })
        this.parent.send(this.parent.options.n2n.protocol, peerId, {
          type: events.n2n.CONNECT_TO_US,
          jobId,
          id: this.parent.id
        }, true).then(() => {
          this._debug('[%s][%s] connectToUs message sent to %s to connect to US..', this.parent.id, jobId, peerId)
        }).catch(e => {
          clearTimeout(tout)
          console.error(e)
          reject(e)
        })
      })
    }
  }
  async _connectToUs ({ id, jobId }) {
    this._debug('[%s][%s][_connectToUs] receive a connectToUs order from %s...', this.parent.id, jobId, id)
    const peerId = id
    const sendResponse = (response, reason) => {
      // send back the response on the inview, because the message comes from the inview...
      this.parent.send(this.parent.options.n2n.protocol, peerId, {
        type: events.n2n.RESPONSE,
        response,
        reason,
        jobId
      }, false).then(() => {
        this._debug('[%s][%s][_connectToUs] send response to %s :', this.parent.id, jobId, id, response)
      }).catch(e => {
        this._debug('[%s][%s][_connectToUs] cannot send response to %s :', this.parent.id, jobId, id, response)
      })
    }
    const p = () => new Promise((resolve, reject) => {
      if (!this.parent.livingOutview.has(peerId) && this.parent.livingInview.has(peerId) && !this.parent.pendingOutview.has(peerId)) {
        // we need to create the connection by exchanging offer between the two peers
        const tout = setTimeout(() => {
          reject(new Error(`[${this.parent.id}][${jobId}][to=${id}][_connectToUs] timeout`))
        }, this.parent.options.n2n.timeout)

        const socket = this.parent.createNewSocket(this.parent.options.socket, peerId, true)
        socket.on('error', (error) => {
          this.parent._manageError(error, peerId, true, (e) => {
            this._debug('[%s][%s][_connectToUs] receive an error during the connection %s...', this.parent.id, jobId, id, e)
            reject(e)
          })
        })
        socket.on(events.socket.EMIT_OFFER, (offer) => {
          const off = {
            jobId,
            initiator: this.parent.id,
            destination: peerId,
            offer,
            offerType: 'new'
          }
          this.sendOfferTo(off)
        })
        socket.connect().then(() => {
          clearTimeout(tout)
          resolve()
        }).catch(e => {
          clearTimeout(tout)
          reject(e)
        })
      } else if (this.parent.livingOutview.has(peerId) && this.parent.livingOutview.get(peerId).socket.status !== 'disconnected') {
        this._debug('[%s][%s][_connectToUs] the peer is in our outview so, just increase occurences %s...', this.parent.id, jobId, id)
        this.parent.connectFromUs(peerId).then(() => {
          this._debug('[%s][%s][_connectToUs] Increase occurences has been done ...', this.parent.id, jobId, id)
          resolve()
        }).catch(e => {
          this._debug('[%s][%s][_connectToUs] Increase occurences has crashed ...', this.parent.id, jobId, id)
          reject(e)
        })
      } else {
        reject(new Error('pending connection'))
      }
    })
    p().then(() => {
      sendResponse(true)
    }).catch(e => {
      this._debug('[%s][%s][_connectToUs] is errored %s...', this.id, jobId, id, e)
      sendResponse(false, e.message)
    })
  }
} // not implemented for the moment

module.exports = DirectSignaling
