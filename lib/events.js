module.exports = {
  socket: {
    RECEIVE_OFFER: 'socket-ro',
    EMIT_OFFER: 'socket-eo',
    EMIT_OFFER_RENEGOCIATE: 'socket-eo-r'
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
    connection: {
      out: 'out',
      in: 'in'
    },
    disconnection: {
      out: 'close_out',
      in: 'close_in'
    },
    crash: {
      out: 'crash_out',
      in: 'crash_in'
    },
    DISCONNECT: 'disc',
    INC_IN: 'inc:in',
    DEC_IN: 'dec:in',
    CONNECT_TO_US: 'c:2:u',
    DIRECT_TO: 'd:2',
    DIRECT_BACK: 'd:b',
    LOCK: 'l',
    UNLOCK: 'ul',
    bridgeIO: {
      BRIDGE: 'bio',
      BRIDGE_FORWARD: 'bio:f',
      BRIDGE_FORWARD_BACK: 'bio:f:b',
      BRIDGE_FORWARD_RESPONSE: 'bio:fr'
    },
    bridgeOO: {
      BRIDGE: 'boo',
      BRIDGE_FORWARD: 'boo:f',
      BRIDGE_FORWARD_BACK: 'boo:f:b',
      BRIDGE_FORWARD_RESPONSE: 'boo:fr'
    },
    bridgeOI: {
      BRIDGE: 'b',
      BRIDGE_FORWARD: 'boi:f',
      BRIDGE_FORWARD_BACK: 'boi:f:b',
      BRIDGE_FORWARD_RESPONSE: 'boi:fr'
    },
    RESPONSE: 'r'
  }
}
