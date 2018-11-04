const errors = require('../errors')
const EventEmitter = require('events')
const events = require('../events')

/**
 * Abstract signaling class. If you want to implement your own signaling service. You can start with this class.
 * @extends EventEmitter
 * @private
 */
class Signaling extends EventEmitter {
  /**
   * @private
   */
  constructor (options = {}) {
    super()
    this.options = options
  }

  /**
   * @description (**Abstract**) Connect the signaling service
   * @param  {Object}  options options for the connection if needed
   * @return {Promise}            Promise resolved when the connection succeeded
   * @private
   */
  async connect (options) {
    return Promise.reject(errors.nyi())
  }

  /**
   * (**Abstract**) Get a new peer from the signaling service, can be undefined or a string representing the peer id to connect with
   * @return {Promise}        Promise resolved with the peerId or undefined as result or reject with an error
   * @private
   */
  async getNewPeer () {
    return Promise.reject(errors.nyi())
  }

  /**
   * (**Abstract**) Send an offer to the signaling service
   * @param  {Object}  offer  the offer to send to the signaling server
   * @return {Promise}        Promise resolved when the offer has been sent
   * @private
   */
  async sendOffer (offer) {
    return Promise.reject(errors.nyi())
  }

  /**
   * Method called when an offer has been received always with the format {initiator, destination, offer}
   * @param  {Object}  offer the offer received
   * @return {void}
   * @private
   */
  receiveOffer (offer) {
    this.emit(events.signaling.RECEIVE_OFFER, offer)
  }
}

module.exports = Signaling
