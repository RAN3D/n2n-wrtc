const SignalingAPI = require('../api').signaling

class OfflineSignaling extends SignalingAPI {
  connect (otherSignaling) {
    if (!otherSignaling) {
      return Promise.reject(new Error('need another offline signaling object'))
    } else {
      return Promise.resolve()
    }
  }
}

module.exports = OfflineSignaling
