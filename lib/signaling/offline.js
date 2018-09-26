const SignalingAPI = require('../api').signaling
const events = require('../events')

class OfflineSignaling extends SignalingAPI {
  async connect () {
    this.emit('connect')
  }

  sendOffer (offer) {
    this.emit(events.signaling.EMIT_OFFER, offer)
  }
}

module.exports = OfflineSignaling
