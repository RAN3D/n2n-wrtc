const lfind = require('lodash.find')
/**
 * Signaling server
 * @function Server
 * @param  {Object} [config=require('./config.json')] Configuration of the signaling server
 * @return {void}
 */
const Server = function (config = require('./config.json')) {
  console.log('Signaling server config: ', config)
  this.app = require('express')()
  this.server = require('http').Server(this.app)
  this.io = require('socket.io')(this.server)
  this.os = require('os')
  this.config = config

  /**
   * Emit an offer to the right client
   * An offer is an object composed of 4 properties:
   * *a type: new or back (respectively for all new offers and accepted offers)
   * *the initiator id
   * *the destination id
   * *the offer (generally the webrtc offer)
   * @event Server#offer
   * @type {Object}
   */
  /**
   * When the signaling server receive an offer it dispatch the offer to right peer, if it is an offer of type 'new' give it to the destination, otherwise give it to the initiator
   * @function receiveOffer
   * @memberof Server
   * @fires Server#offer
   * @param  {Object} self        Server instance
   * @param  {Object} socket      Socket instance
   * @param  {Object} offer the offer sent by the client, need to be at least {initiator, destination, type, offer} and never change between the exchange (except for the offer.offer object and the offer.type)
   * @param  {String} offer.initiator   The initiator id (always the id of the peer that initiated the connection)
   * @param  {String} offer.destination The destination id (always the id of the peer that will be connected with the initiator)
   * @param  {String} offer.type        The type of the id (new or back)
   * @param  {Object} offer.offer       The offer sent (generally the webrtc offer)
   * @return {void}
   */
  this.receiveOffer = (self, socket, { initiator, destination, type, offer }) => {
    let sock
    if (type === 'back') {
      sock = lfind(self.io.sockets.sockets, sock => sock.userId === initiator)
    } else {
      sock = lfind(self.io.sockets.sockets, sock => sock.userId === destination)
    }
    console.log('[user=%s][type=%s] receiving an offer to emit to: %s', socket.userId, type, sock.userId)
    sock.emit('offer', { initiator, destination, type, offer })
  }
  /**
   * Emit on the event 'getNewPeer' a random peer from the room of the asker
   * @function getNewPeer
   * @memberof Server
   * @fires Server#jobId
   * @param  {Object} self Server instance
   * @param  {Object} socket the socket representing a client see socket.io documentation
   * @param  {String} jobId event name on which we will emit the result of the function
   * @return {void}
   */
  this.getNewPeer = (self, socket, jobId) => {
    // now find the user
    const rooms = self.io.sockets.adapter.rooms
    const ioroom = rooms[socket.userRoom]
    if (ioroom) {
      const myId = socket.userId
      let socks = Object.keys(ioroom.sockets)
      let val = []
      let i = 0
      while (i < config.max && i < socks.length) {
        const userId = self.io.sockets.sockets[socks[i]].userId
        console.log('User id: ', userId, ' Socket id: ', myId)
        if (userId !== myId) val.push(userId)
        i++
      }
      let rn
      if (val.length !== 0) {
        rn = Math.floor(Math.random() * val.length)
        rn = val[rn]
      }
      console.log('[%s ]Emitting the offer to: %s', socket.userId, rn)
      socket.emit(jobId, rn)
    }
  }

  this.server.listen(this.config.port, () => {
    // https://stackoverflow.com/a/8440736
    const ifaces = this.os.networkInterfaces()
    Object.keys(ifaces).forEach(function (ifname) {
      var alias = 0

      ifaces[ifname].forEach(function (iface) {
        if (iface.family !== 'IPv4' || iface.internal !== false) {
          // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
          return
        }

        if (alias >= 1) {
          // this single interface has multiple ipv4 addresses
          console.log('Running on : ', `${ifname + ':' + alias} => ${iface.address}:${config.port}`)
          console.log('Or running on: ', `${config.host}:${config.port}`)
        } else {
          // this interface has only one ipv4 adress
          console.log('Running on : ', `${ifname} => ${iface.address}:${config.port}`)
          console.log('Or running on: ', `${config.host}:${config.port}`)
        }
        ++alias
      })
    })
  })

  this.io.on('connection', (socket) => {
    const room = socket.handshake.query.room
    const id = socket.handshake.query.id
    socket.userId = id
    socket.userRoom = room
    socket.join(room)
    console.log('user' + id + ' joined room #' + room)

    /**
     * Socket event when an offer is received from the client
     * @type {String}
     */
    socket.on('offer', (offer) => {
      this.receiveOffer(this, socket, offer)
    })

    /**
     * getNewPeer get a random peer from the room of the asker
     * @type {String}
     */
    socket.on('getNewPeer', (offer) => {
      this.getNewPeer(this, socket, offer)
    })
  })
}

module.exports = Server
