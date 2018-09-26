const lfind = require('lodash.find')
/**
 * Signaling server
 * @function Server
 * @param  {Object} [config=require('./config.json')] Configuration of the signaling server
 * @return {void}
 */
const Server = function (config = require('./config.json')) {
  console.log('Signaling server config: ', config)
  const app = require('express')()
  const server = require('http').Server(app)
  const io = require('socket.io')(server)
  const os = require('os')

  server.listen(config.port, () => {
    // https://stackoverflow.com/a/8440736
    const ifaces = os.networkInterfaces()
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

  io.on('connection', function (socket) {
    onConnection(io, config, socket)
  })
}

/**
 * Listening on the connection event, when a new peer just arrived, add it to the provided room and set its user id
 * @memberof Server
 * @param  {Object} io Socket.io instance
 * @param  {Object} [config=require('./config.json')] Configuration of the signaling server
 * @param  {Object} socket the socket representing a client see socket.io documentation
 * @param  {String} socket.query.hanshake.room room of the client
 * @param  {String} socket.query.hanshake.id user id (different of socket.io id)
 * @return {void}
 */
function onConnection (io, config, socket) {
  const room = socket.handshake.query.room
  const id = socket.handshake.query.id
  socket.userId = id
  socket.join(room)
  console.log('user' + id + ' joined room #' + room)

  /**
   * Socket event when an offer is received from the client
   * @type {String}
   */
  socket.on('offer', ({ initiator, destination, type, offer }) => {
    let sock
    if (type === 'back') {
      sock = lfind(io.sockets.sockets, sock => sock.userId === initiator)
    } else {
      sock = lfind(io.sockets.sockets, sock => sock.userId === destination)
    }
    console.log('[user=%s][type=%s] receiving an offer to emit to: %s', socket.userId, type, sock.userId)
    sock.emit('offer', { initiator, destination, type, offer })
  })

  /**
   * getNewPeer get a random peer from the room of the asker
   * @type {String}
   */
  socket.on('getNewPeer', (offer) => {
    getNewPeer(io, config, socket, offer)
  })
}
/**
 * Emit an anwser when we receive an action eg: getNewPeer will emit on the jobId parameter
 * @event Server#offer.jobId
 * @type {*}
 */
/**
 * Emit on the event 'getNewPeer' a random peer from the room of the asker
 * @memberof Server
 * @fires Server#jobId
 * @param  {Object} io Socket.io instance
 * @param  {Object} [config=require('./config.json')] Configuration of the signaling server
 * @param  {Object} socket the socket representing a client see socket.io documentation
 * @param  {Object} offer  offer that the client has to send
 * @param  {Object} offer.jobId  jobId, it is used for emitting the response, as the client will listing on it.
 * @return {void}
 */
function getNewPeer (io, config, socket, offer) {
  // now find the user
  const rooms = io.sockets.adapter.rooms
  const ioroom = rooms[offer.room]
  if (ioroom) {
    const myId = socket.userId
    let socks = Object.keys(ioroom.sockets)
    let val = []
    let i = 0
    while (i < config.max && i < socks.length) {
      const userId = io.sockets.sockets[socks[i]].userId
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
    socket.emit(offer.jobId, rn)
  } else {
    socket.emit('err-' + offer.jobId, 'room not found, Are you connected? Something is wrong, perhaps it needs a refresh.')
  }
}

module.exports = Server
