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
    INVIEW_REQUEST: 'n:i:i', // 'neighborhood:increase:inview',
    INVIEW_ANSWER: 'n:i:i:a', // 'neighborhood:increase:inview:answer'
    DISCONNECT_REQUEST: 'd:d:i', // 'disconnection:decrease:inview'
    DISCONNECT_ANSWER: 'd:d:i:a', // 'disconnection:decrease:inview:answer'
    DISCONNECT_DIRECT: 'd:i', // just disconnect immediatly by receiving this
    DISCONNECT_DIRECT_ANSWER: 'd:i:a', // when receiving the answer disconnect
    DISCONNECT_ALL: 'd:a', // disconnect all connection
    DISCONNECT_ALL_ANSWER: 'd:a:a' // disconnect all connection answer
  }
}

module.exports = events
