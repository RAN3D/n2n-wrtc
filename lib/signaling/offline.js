const SignalingAPI = require('./signaling')
const events = require('../events')

/**
 * Perform an offline connection by exchanging offer directly using objects.
 * @extends SignalingAPI
 * @private
 */
class OfflineSignaling extends SignalingAPI {
  /**
   * @private
   */
  constructor (options, n2n) {
    super(options)
    this._debug = (require('debug'))('n2n:offline')
    this.parent = n2n
    this.on(events.signaling.RECEIVE_OFFER, ({ jobId, initiator, destination, type, offer }) => {
      // do we have the initiator in our list of connections?
      this._debug('[%s] receive an offline offer ', this.parent.id, { jobId, initiator, destination, type, offer })
      if (!this.parent.pendingInview.has(initiator) && type === 'new') {
        // we do have the socket for the moment, create it
        this.parent.createNewSocket(this.parent.options.socket, initiator, false)
        this.parent.pendingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          const off = {
            jobId,
            initiator,
            destination,
            offer: socketOffer,
            type: 'back'
          }
          this.sendOffer(off)
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
   * Just connect.
   * @return {Promise}
   * @private
   */
  async connect () {
    this.emit('connect')
  }

  /**
   * @param  {Object} offer Object containing offers
   * @return {void}
   * @private
   */
  sendOffer (offer) {
    this.emit(events.signaling.EMIT_OFFER, offer)
  }
}

module.exports = OfflineSignaling
