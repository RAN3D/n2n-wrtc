const SignalingAPI = require('./signaling')
const events = require('../events')
const debug = require('debug')
const short = require('short-uuid')
const translator = short()

class BridgeOI extends SignalingAPI {
  constructor (options, n2n) {
    super(options)
    this.parent = n2n
    this._debug = debug('n2n:bridge:oi')
    this.on(events.signaling.RECEIVE_OFFER, ({ jobId, initiator, destination, forward, offerType, offer }) => {
      if (!initiator || !destination || !offer || !offerType) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      // do we have the initiator in our list of connections?
      if (!this.parent.pendingInview.has(initiator) && offerType === 'new') {
        // we do have the socket for the moment, create it
        this.parent.createNewSocket(this.parent.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.parent.pendingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.sendOfferBack({
            jobId,
            initiator,
            destination,
            forward,
            offer: socketOffer,
            offerType: 'back'
          })
        })
        this.parent.pendingInview.get(initiator).socket.on(events.socket.EMIT_OFFER_RENEGOCIATE, (socketOffer) => {
          const off = {
            jobId,
            initiator,
            destination,
            offer: socketOffer,
            offerType: 'back'
          }
          this.parent.signaling.direct.sendOfferBackRenegociate(off)
        })
        // WE RECEIVE THE OFFER ON THE ACCEPTOR
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
    offer.type = events.n2n.bridgeOI.BRIDGE_FORWARD
    this._debug('[%s] send to forwarding peer: %s', this.parent.id, offer.forward)
    // send the message on an (inview/outview) link, it depends on the argument
    this.parent.send(this.parent.options.n2n.protocol, offer.forward, offer, false)
  }
  /**
   * Send back an accepted offer to the forwarding peer
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async sendOfferBack (offer) {
    offer.type = events.n2n.bridgeOI.BRIDGE_FORWARD_BACK
    this._debug('[%s] send back the offer to the forwarding peer: %s', this.parent.id, offer.forward, offer)
    // always send back on an inview link
    this.parent.send(this.parent.options.n2n.protocol, offer.forward, offer, true)
  }
  /**
   * Forward an offer to the peer that will accept the offer
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async forward (offer) {
    offer.type = events.n2n.bridgeOI.BRIDGE_FORWARD_RESPONSE
    this._debug('[%s] forwarding to %s', this.parent.id, offer.destination, offer)
    // always forward on an outview link
    this.parent.send(this.parent.options.n2n.protocol, offer.destination, offer, false)
  }
  /**
   * Forward back an accepted offer to the peer that initiate the connection
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async forwardBack (offer) {
    offer.type = events.n2n.bridgeOI.BRIDGE_FORWARD_RESPONSE
    this._debug('[%s] forwarding back to %s', this.parent.id, offer.initiator, offer)
    // forward back the message on an (inview/outview) link, it depends on the argument
    this.parent.send(this.parent.options.n2n.protocol, offer.initiator, offer, true)
  }

  /**
   * Perform a bridge without locking any connection, this is your responsability to lock connections correctly.
   * From (outview) to dest (inview)
   * @param  {String}  from peer id (initiator)
   * @param  {String}  dest   peer id (destination)
   * @param  {Number} [timeout=this.parent.options.n2n.timeout] time to wait before rejecting.
   * @return {Promise}
   */
  async bridge (from, dest, timeout = this.parent.options.n2n.timeout) {
    return new Promise((resolve, reject) => {
      if (this.parent.livingOutview.has(from) && this.parent.livingInview.has(dest)) {
        const jobId = translator.new()
        const tout = setTimeout(() => {
          reject(new Error('timeout'))
        }, timeout)
        this.parent.events.once(jobId, (msg) => {
          clearTimeout(tout)
          if (msg.response) {
            resolve()
          } else {
            reject(new Error('bridge rejected.'))
          }
        })
        this.parent.send(this.parent.options.n2n.protocol, from, {
          type: events.n2n.bridgeOI.BRIDGE,
          from,
          dest,
          forward: this.parent.id,
          jobId
        }, true).catch(e => {
          reject(e)
        })
      } else if (!this.parent.livingOutview.has(dest)) {
        reject(new Error(`[${this.parent.id}/bridgeOO] from need to be in our outview and dest in our inview`))
      }
    })
  }
  _bridge (id, { from, dest, forward, jobId }) {
    const sendResponse = (response) => {
      this.parent.send(this.parent.options.n2n.protocol, forward, {
        type: events.n2n.RESPONSE,
        response,
        jobId
      }, false).catch(e => {
        console.error('cannot send response', e)
      })
    }
    if (this.parent.livingOutview.has(dest)) {
      this.parent.increaseOccurences(dest, true).then(() => {
        sendResponse(true)
      }).catch(e => {
        console.error('cannot increase occurences', e)
        sendResponse(false)
      })
    } else if (!this.parent.livingOutview.has(dest) && !this.parent.pendingOutview.has(dest)) {
      new Promise((resolve, reject) => {
        const tout = setTimeout(() => {
          reject(new Error('timeout'))
        }, this.parent.options.n2n.timeout)
        const socket = this.parent.createNewSocket(this.parent.options.socket, dest, true)
        socket.on('error', (error) => {
          this.parent._manageError(error, dest, true, reject)
        })
        socket.on(events.socket.EMIT_OFFER, (offer) => {
          const off = {
            initiator: this.parent.id,
            destination: dest,
            forward,
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
      }).then(() => {
        sendResponse(true)
      }).catch(e => {
        sendResponse(false)
      })
    } else if (!this.parent.livingOutview.has(dest) && this.parent.pendingOutview.has(dest)) {
      const tout = setTimeout(() => {
        sendResponse(false, `pending connection has never been connected. (from: ${from}, dest:${dest} forward: ${forward})`)
      }, this.parent.options.n2n.timeout)
      this.parent.pendingOutview.get(dest).socket.once('connect', () => {
        clearTimeout(tout)
        this.parent.connectFromUs(dest).then(() => {
          sendResponse(true)
        }).catch(e => {
          sendResponse(false, e.message)
        })
      })
    } else {
      sendResponse(false)
    }
  }
} // not implemented for the moment

module.exports = BridgeOI
