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
    OCC_INC: 'o:i', // when we have to increase the occurence on the inview
    OCC_DEC: 'o:d' // when we have to decrease the occurence on the inview
  }
}

module.exports = events
