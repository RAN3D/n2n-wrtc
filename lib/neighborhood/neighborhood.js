const NeighborhoodAPI = require('../api').neighborhood
const short = require('short-uuid')
const translator = short()
const lmerge = require('lodash.merge')
const OfflineSignaling = require('../signaling').offline
const OnlineSignaling = require('../signaling').online
const events = require('../events')
const errors = require('../errors')

/**
 * @class
 * @classdesc Neighborhood class, it contains a list of socket. These sockets are direct neighbors of this class.
 * it allows offline connection and online connections
 * @extends Neighborhood
 */
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
      },
      signaling: lmerge({ room: 'default', id }, require('../signaling/server/config.json'))
    }, options)
    super(options)
    this._debug('Options set: ', this.options)
    this.id = this.options.neighborhood.id
    this.signaling = {
      offline: new OfflineSignaling(this.options.signaling),
      online: new OnlineSignaling(this.options.signaling)
    }

    this.signaling.offline.on(events.signaling.RECEIVE_OFFER, ({ initiator, destination, type, offer }) => {
      if (!initiator || !destination || !offer || !type) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      // do we have the initiator in our list of connections?
      if (!this.living.has(initiator) && type === 'new') {
        // we do have the socket for the moment, create it
        const socket = this.createNewSocket(this.options.socket, initiator)
        // const socket = this.createNewSocket(lmerge(this.options.socket, { initiator: false }), initiator)
        this.living.set(initiator, socket)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.living.get(initiator).on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.offline.sendOffer({
            initiator,
            destination,
            offer: socketOffer,
            type: 'back'
          })
        })
        this.living.get(initiator).on('connect', () => {
          this._debug('Peer %s is online', initiator)
        })
        this.living.get(initiator).emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (type === 'new') {
          try {
            this.living.get(initiator).emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (type === 'back') {
          try {
            this.living.get(destination).emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        }
      }
    })

    this.signaling.online.on(events.signaling.RECEIVE_OFFER, ({ initiator, destination, type, offer }) => {
      if (!initiator || !destination || !offer || !type) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      if (!this.living.has(initiator) && type === 'new') {
        // we do have the socket for the moment, create it
        const socket = this.createNewSocket(this.options.socket, initiator)
        this.living.set(initiator, socket)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.living.get(initiator).on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.online.sendOffer({
            initiator,
            destination,
            offer: socketOffer,
            type: 'back'
          })
        })
        this.living.get(initiator).on('connect', () => {
          this._debug('Peer %s is online', initiator)
        })
        this.living.get(initiator).emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (type === 'new') {
          try {
            this.living.get(initiator).emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (type === 'back') {
          try {
            this.living.get(destination).emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        }
      }
    })
  }

  async connect (neighbor) {
    // get peers id and check if we already have the neighbor connection
    // yes? => increment occurences
    // no? => create it
    if (neighbor) {
      return new Promise(async (resolve, reject) => {
        await this.signaling.offline.connect()
        const socket = this.createNewSocket(this.options.socket, neighbor.id)
        socket.on('error', (error) => {
          reject(error)
        })
        socket.on(events.socket.EMIT_OFFER, (offer) => {
          neighbor.signaling.offline.receiveOffer({
            initiator: this.id,
            destination: neighbor.id,
            offer,
            type: 'new'
          })
        })
        // simulate the signaling server by directly listening on the neighbor on emitted offers
        neighbor.signaling.offline.on(events.signaling.EMIT_OFFER, ({ initiator, destination, offer, type }) => {
          if (initiator === this.id && destination === neighbor.id && offer && type) {
            socket._receiveOffer(offer)
          }
        })
        this.living.set(neighbor.id, socket)
        socket.connect().then(() => {
          this._debug('Peer %s is online', neighbor.id)
          resolve(neighbor.id)
        }).catch(e => {
          reject(e)
        })
      })
    } else {
      return new Promise((resolve, reject) => {
        this.signaling.online.connect(this.options.signaling.room).then(async () => {
          const neighborId = await this.signaling.online.getNewPeer({
            initiator: this.id,
            room: this.options.signaling.room
          })
          if (neighborId) {
            const socket = this.createNewSocket(this.options.socket, neighborId)
            socket.on('error', (error) => {
              reject(error)
            })
            socket.on(events.socket.EMIT_OFFER, (offer) => {
              const off = {
                initiator: this.id,
                destination: neighborId,
                offer,
                type: 'new'
              }
              this.signaling.online.sendOffer(off)
            })
            this.living.set(neighborId, socket)
            socket.connect().then(() => {
              this._debug('Peer %s is online', neighborId)
              resolve(neighborId)
            }).catch(reject)
          } else {
            resolve(neighborId)
          }
        }).catch(e => {
          reject(e)
        })
      })
    }
  }

  async send (peerId, message) {
    if (this.living.has(peerId)) return this.living.get(peerId).send(message)
    throw errors.peerNotFound(peerId)
  }

  async disconnect (userId) {
    if (userId) {
      if (!this.living.has(userId)) {
        throw errors.peerNotFound(userId)
      } else {
        return this.living.has(userId).disconnect().then(() => {
          this.living.delete(userId)
          return Promise.resolve()
        })
      }
    } else {
      let promises = []
      this.living.forEach((socket, id) => {
        const p = new Promise((resolve, reject) => {
          socket.disconnect().then(() => {
            this.living.delete(id)
            resolve()
          }).catch(reject)
        })
        promises.push(p)
      })
      return Promise.all(promises)
    }
  }

  createNewSocket (options, id) {
    const newSocket = new this.options.neighborhood.SocketClass(options)
    this._debug('[%s] new socket created: %s', this.id, newSocket.socketId)
    newSocket.on('data', (data) => { this.receiveData(id, data) })
    newSocket.on('close', () => {
      if (this.living.has(id)) {
        this.living.delete(id)
        this.emit('close', id)
      }
    })
    return newSocket
  }
}

module.exports = Neighborhood
