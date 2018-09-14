const lmerge = require('lodash.merge')
const errors = require('../errors')

class Signaling {
  constructor (options = { signaling: {} }) {
    options = lmerge({
      address: 'http://localhost:6060'
    }, options.signaling)
    this.options = options
    this.events = new (require('events'))()
  }

  /**
   * @description [**To Impelment**] Connect the signaling service
   * @param  {Object}  options options for the connection if needed
   * @return {Promise}            Promise resolved when the connection succeeded
   */
  async connect (options) {
    return Promise.reject(errors.nyi())
  }

  /**
   * Get a new peer from the signaling service, can be undefined or a string representing the peer id to connect with
   * @param  {[type]}  peerId string representing the peer id that initiaed the offer
   * @return {Promise}        Promise resolved with the peerId or undefined as result or reject with an error
   */
  async getNewPeer (peerId) {
    return Promise.reject(errors.nyi())
  }

  /**
   * Send an offer to the signaling service
   * @param  {String}  peerId the peer id that wants to send the offer
   * @param  {String}  destination destination peer id: id of the peer we will be connected with
   * @param  {Object}  offer  the offer to send to the signaling server
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async sendOffer (peerId, destination, offer) {
    return Promise.reject(errors.nyi())
  }

  /**
   * Send an accepted offer to the signaling service
   * @param  {[type]}  peerId        the peer id that wants to send the accepted offer
   * @param  {String}  destination destination peer id: id of the peer we will be connected with
   * @param  {Object}  acceptedOffer the accepted offer, can be anything representing information needed for the connection eg: a webrtc offer
   * @return {Promise}               Promise resolved when the accepted offer has been sent
   */
  async sendAcceptedOffer (peerId, destination, acceptedOffer) {
    return Promise.reject(errors.nyi())
  }

  /**
   * Method called when an offer has been received always with the format
   * @param  {String} initiator Peer id that send the offer
   * @param  {Object}  offer the offer received
   * @return {void}
   */
  receiveOffer (initiator, offer) {
    this.events.emit('receive_offer', initiator, offer)
  }

  /**
   * Method called when an offer has been received always with the format
   * @param  {String} initiator Peer id that send the offer
   * @param  {Object}  offer the offer received
   * @return {void}
   */
  receiveAcceptedOffer (initiator, offer) {
    this.events.emit('receive_accepted_offer', initiator, offer)
  }
}

module.exports = Signaling
