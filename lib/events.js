const events = {
  socket: {
    RECEIVE_OFFER: 'socket-ro',
    EMIT_OFFER: 'socket-eo'
  },
  signaling: {
    RECEIVE_OFFER: 'signalig-ro',
    EMIT_OFFER: 'signaling-eo'
  },
  data: {
    OCC_INC: 'o:i' // when we have to increase the occurence
  }
}

module.exports = events
