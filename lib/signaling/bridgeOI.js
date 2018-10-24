const SignalingAPI = require('../api').signaling
const events = require('../events')
const debug = require('debug')
const short = require('short-uuid')
const translator = short()

class BridgeOI extends SignalingAPI {
  constructor (options, n2n) {
    super(options)
    this.parent = n2n
    this._debug = debug('n2n:bridge:oi')
    this.on(events.signaling.RECEIVE_OFFER, ({ initiator, destination, forward, offerType, offer }) => {
      if (!initiator || !destination || !offer || !offerType) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      // do we have the initiator in our list of connections?
      if (!this.parent.view.livingInview.has(initiator) && offerType === 'new') {
        // we do have the socket for the moment, create it
        this.parent.view.createNewSocket(this.parent.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.parent.view.livingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.sendOfferBack({
            initiator,
            destination,
            forward,
            offer: socketOffer,
            offerType: 'back'
          })
        })
        // WE RECEIVE THE OFFER ON THE ACCEPTOR
        this.parent.view.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (offerType === 'new') {
          try {
            // WE RECEIVE THE OFFER ON THE ACCEPTOR
            this.parent.view.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (offerType === 'back') {
          try {
            // WE RECEIVE THE ACCEPTED OFFER ON THE INITIATOR
            if (this.parent.view.livingOutview.isIn(destination) && this.parent.view.livingOutview.get(destination).socket.status !== 'connected') {
              this.parent.view.livingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
            }
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
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
   * From (inview) to dest (outview)
   * @param  {String}  from peer id (initiator)
   * @param  {String}  dest   peer id (destination)
   * @param  {Number} [timeout=this.parent.options.n2n.timeout] time to wait before rejecting.
   * @return {Promise}
   */
  async bridge (from, dest, timeout = this.parent.options.n2n.timeout) {
    return new Promise((resolve, reject) => {
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
    })
  }
  _bridge (id, { from, dest, forward, jobId }) {
    if (this.parent.view.livingOutview.exist(dest)) {
      try {
        this.parent.view.increaseOccurences(dest, true).then(() => {
          this.parent.send(this.parent.options.n2n.protocol, forward, {
            type: events.n2n.RESPONSE,
            response: true,
            jobId
          }, false).catch(e => {
            console.error('cannot send response', e)
          })
        }).catch(e => {
          console.error('cannot increase occurences', e)
        })
      } catch (e) {
        console.error(e)
      }
    } else if (!this.parent.view.livingOutview.isIn(dest)) {
      new Promise((resolve, reject) => {
        const tout = setTimeout(() => {
          reject(new Error('timeout'))
        }, this.parent.options.n2n.timeout)
        const socket = this.parent.view.createNewSocket(this.parent.options.socket, dest, true)
        socket.on('error', (error) => {
          this.parent.view._manageError(error, dest, true, reject)
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
        this.parent.view.increaseOccurences(dest, true).then(() => {
          this.parent.send(this.parent.options.n2n.protocol, forward, {
            type: events.n2n.RESPONSE,
            response: true,
            jobId
          }, false).catch(e => {
            console.error('cannot send response to ' + forward, e)
          })
        }).catch(e => {
          console.error('cannot increase occurences for ' + dest, e)
        })
      }).catch(e => {
        this.parent.send(this.parent.options.n2n.protocol, forward, {
          type: events.n2n.RESPONSE,
          response: false,
          jobId
        }, false).catch(e => {
          console.error('cannot send response to ' + forward, e)
        })
      })
    } else {
      this.parent.send(this.parent.options.n2n.protocol, forward, {
        type: events.n2n.RESPONSE,
        response: false,
        jobId
      }, false).catch(e => {
        console.error('cannot send response to ' + forward, e)
      })
    }
  }
} // not implemented for the moment

module.exports = BridgeOI
