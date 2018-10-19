module.exports = {
  socket: {
    RECEIVE_OFFER: 'socket-ro',
    EMIT_OFFER: 'socket-eo'
  },
  signaling: {
    RECEIVE_OFFER: 'signalig-ro',
    EMIT_OFFER: 'signaling-eo'
  },
  neighborhood: {
    OCC_INC: 'o:i', // when we have to increase the occurence on the inview
    OCC_DEC: 'o:d' // when we have to decrease the occurence on the inview
  },
  n2n: {
    CONNECT_TO_US: 'c:2:u',
    DIRECT_TO: 'd:2',
    DIRECT_BACK: 'd:b',
    BRIDGE: 'b',
    BRIDGE_FORWARD: 'b:f',
    BRIDGE_FORWARD_BACK: 'b:f:b',
    BRIDGE_FORWARD_RESPONSE: 'b:fr',
    RESPONSE: 'r'
  }
}
