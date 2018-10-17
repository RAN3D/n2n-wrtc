const SignalingAPI = require('../api').signaling
const events = require('../events')
const debug = require('debug')

class BridgeSignaling extends SignalingAPI {
  constructor (options, n2n) {
    super(options)
    this.parent = n2n
    this._debug = debug('n2n:bridge')
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
    offer.type = events.n2n.BRIDGE_FORWARD
    this._debug('[%s] send to forwarding peer: %s', this.parent.id, offer.forward, offer)
    this.parent.send(offer.forward, offer)
  }
  /**
   * Send back an accepted offer to the forwarding peer
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async sendOfferBack (offer) {
    offer.type = events.n2n.BRIDGE_FORWARD_BACK
    this._debug('[%s] send back the offer to the forwarding peer: %s', this.parent.id, offer.forward, offer)
    this.parent.send(offer.forward, offer)
  }
  /**
   * Forward an offer to the peer that will accept the offer
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async forward (offer) {
    offer.type = events.n2n.BRIDGE_FORWARD_RESPONSE
    this._debug('[%s] forwarding to %s', this.parent.id, offer.destination, offer)
    this.parent.send(offer.destination, offer)
  }
  /**
   * Forward back an accepted offer to the peer that initiate the connection
   * @param  {Object}  offer  the offer to send
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async forwardBack (offer) {
    offer.type = events.n2n.BRIDGE_FORWARD_RESPONSE
    this._debug('[%s] forwarding back to %s', this.parent.id, offer.initiator, offer)
    this.parent.send(offer.initiator, offer)
  }
} // not implemented for the moment

module.exports = BridgeSignaling
