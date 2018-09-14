const SignalingAPI = require('../api').signaling
const events = require('../events')

class OfflineSignaling extends SignalingAPI {
  sendOffer (offer) {
    this.emit(events.signaling.EMIT_OFFER, offer)
  }
}

module.exports = OfflineSignaling
