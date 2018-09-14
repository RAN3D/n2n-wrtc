const NeighborhoodAPI = require('../api').neighborhood
const short = require('short-uuid')
const translator = short()
const lmerge = require('lodash.merge')
const OfflineSignaling = require('../signaling').offline
const events = require('../events')
const errors = require('../errors')

class Neighborhood extends NeighborhoodAPI {
  constructor (options) {
    const id = translator.new()
    options = lmerge({
      neighborhood: {
        id,
        SocketClass: require('../sockets').simplepeer
      },
      socket: {
        objectMode: true
      }
    }, options)
    super(options)
    this._debug('Options set: ', this.options)
    this.id = id
    this.signaling = {
      offline: new OfflineSignaling()
    }

    this.signaling.offline.on(events.signaling.RECEIVE_OFFER, ({ initiator, destination, offer }) => {
      if (!initiator || !destination || !offer) throw new Error('PLEASE REPORT, Problem with the offline signaling service.')
      // do we have the initiator in our list of connections?
      if (!this.living.has(initiator)) {
        // we do have the socket for the moment, create it
        const socket = this.createNewSocket(this.options.socket, initiator)
        this.living.set(initiator, socket)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.living.get(initiator).on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.offline.sendOffer({ initiator, destination, offer: socketOffer })
        })
        this.living.get(initiator).on('connect', () => {
          console.log('Peer %s is online', initiator)
        })
      }
      // dispatch the offer to the socket
      this.living.get(initiator).emit(events.socket.RECEIVE_OFFER, offer)
    })
  }

  async connect (neighbor) {
    // get peers id and check if we already have the neighbor connection
    // yes? => increment occurences
    // no? => create it
    if (neighbor) {
      return new Promise((resolve, reject) => {
        const socket = this.createNewSocket(this.options.socket, neighbor.id)
        socket.on('error', (error) => {
          reject(error)
        })
        socket.on(events.socket.EMIT_OFFER, (offer) => {
          const off = {
            initiator: this.id,
            destination: neighbor.id,
            offer
          }
          // console.log(this.id, 'emitting an offer: ', off)
          neighbor.signaling.offline.receiveOffer(off)
        })
        neighbor.signaling.offline.on(events.signaling.EMIT_OFFER, ({ initiator, destination, offer }) => {
          if (initiator === this.id && destination === neighbor.id && offer) {
            socket._receiveOffer(offer)
          }
        })
        this.living.set(neighbor.id, socket)
        socket.connect().then(() => {
          console.log('Peer %s is online', neighbor.id)
          resolve()
        }).catch(reject)
      })
    }
  }

  async send (peerId, message) {
    if (this.living.has(peerId)) return this.living.get(peerId).send(message)
    throw errors.peerNotFound(peerId)
  }

  async disconnect (options) {
    //
  }

  createNewSocket (options, id) {
    const newSocket = new this.options.neighborhood.SocketClass(options)
    newSocket.on('data', (data) => { this.receiveData(id, data) })
    return newSocket
  }
}

module.exports = Neighborhood
