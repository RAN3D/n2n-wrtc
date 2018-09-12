const Socket = require('./api').socket
module.exports = class SimplePeerWrapper extends Socket {
  constructor(options, signaling) {
    super(options, signaling)
  }
}
