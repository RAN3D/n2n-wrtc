const errors = require('../errors')
const EventEmitter = require('events')
const events = require('../events')

class Signaling extends EventEmitter {
  constructor (options = {}) {
    super()
    this.options = options
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
   * @param  {String}  peerId string representing the peer id that initiaed the offer
   * @return {Promise}        Promise resolved with the peerId or undefined as result or reject with an error
   */
  async getNewPeer (peerId) {
    return Promise.reject(errors.nyi())
  }

  /**
   * Send an offer to the signaling service
   * @param  {Object}  offer  the offer to send to the signaling server
   * @return {Promise}        Promise resolved when the offer has been sent
   */
  async sendOffer (offer) {
    return Promise.reject(errors.nyi())
  }

  /**
   * Method called when an offer has been received always with the format {initiator, destination, offer}
   * @param  {Object}  offer the offer received
   * @return {void}
   */
  receiveOffer (offer) {
    this.emit(events.signaling.RECEIVE_OFFER, offer)
  }
}

module.exports = Signaling
