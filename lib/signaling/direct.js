const SignalingAPI = require('../api').signaling
const events = require('../events')
const debug = require('debug')

class DirectSignaling extends SignalingAPI {
  constructor (options, n2n) {
    super(options)
    this.parent = n2n
    this._debug = debug('n2n:direct')
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
    this._debug('[%s] send to direct peer: %s', this.parent.id, offer.destination, offer)
    this.parent.send(offer.destination, offer).catch(e => {
      console.error('[%s] send to direct, error', this.parent.id, e)
    }).then(() => {
      console.log('[%s] send to direct, message sent.', this.parent.id)
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
    this.parent.send(offer.initiator, offer).catch(e => {
      console.error('[%s] send back to direct, error', this.parent.id, e)
    }).then(() => {
      console.log('[%s] send back to direct, message sent.', this.parent.id)
    })
  }
} // not implemented for the moment

module.exports = DirectSignaling
