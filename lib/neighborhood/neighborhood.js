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
        SocketClass: require('../sockets').simplepeer,
        timeoutDisconnect: 20000
      },
      socket: {
        objectMode: false
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
      if (!this.livingInview.has(initiator) && type === 'new') {
        // we do have the socket for the moment, create it
        this.createNewSocket(this.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.livingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.offline.sendOffer({
            initiator,
            destination,
            offer: socketOffer,
            type: 'back'
          })
        })
        // WE RECEIVE THE OFFER ON THE ACCEPTOR
        this.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (type === 'new') {
          try {
            // WE RECEIVE THE OFFER ON THE ACCEPTOR
            this.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (type === 'back') {
          try {
            // WE RECEIVE THE ACCEPTED OFFER ON THE INITIATOR
            this.livingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        }
      }
    })

    this.signaling.online.on(events.signaling.RECEIVE_OFFER, ({ initiator, destination, type, offer }) => {
      if (!initiator || !destination || !offer || !type) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      if (!this.livingInview.has(initiator) && type === 'new') {
        // we do have the socket for the moment, create it
        this.createNewSocket(this.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.livingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.online.sendOffer({
            initiator,
            destination,
            offer: socketOffer,
            type: 'back'
          })
        })
        this.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (type === 'new') {
          try {
            this.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (type === 'back') {
          try {
            this.livingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        }
      }
    })
  }

  async connect (neighbor, signaling = this.signaling.online) {
    // get peers id and check if we already have the neighbor connection
    // yes? => increment occurences
    // no? => create it
    if (neighbor) {
      if (this.livingOutview.has(neighbor.id)) {
        console.log('direct with logical link')
        return this.increaseOccurences(neighbor.id).then(() => {
          return neighbor.id
        })
      } else {
        console.log('direct with physical link')
        signaling = this.signaling.offline
        return new Promise(async (resolve, reject) => {
          await signaling.connect()
          const socket = this.createNewSocket(this.options.socket, neighbor.id, true)
          socket.on('error', (error) => {
            this._manageError(error, neighbor.id, reject)
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
          neighbor.signaling.offline.on(events.signaling.EMIT_OFFER, (offer) => {
            this.signaling.offline.emit(events.signaling.RECEIVE_OFFER, offer)
          })
          socket.connect().then(() => {
            this.increaseOccurences(neighbor.id, true).then(() => {
              resolve(neighbor.id)
            })
          }).catch(e => {
            reject(e)
          })
        })
      }
    } else {
      return new Promise((resolve, reject) => {
        signaling.connect(this.options.signaling.room).then(async () => {
          const neighborId = await signaling.getNewPeer({
            initiator: this.id,
            room: this.options.signaling.room
          })
          if (neighborId) {
            if (this.livingOutview.has(neighborId)) {
              this.increaseOccurences(neighborId).then(() => {
                resolve(neighborId)
              }).catch(e => {
                reject(e)
              })
            } else {
              const socket = this.createNewSocket(this.options.socket, neighborId, true)
              socket.on('error', (error) => {
                this._manageError(error, neighborId, reject)
              })
              socket.on(events.socket.EMIT_OFFER, (offer) => {
                const off = {
                  initiator: this.id,
                  destination: neighborId,
                  offer,
                  type: 'new'
                }
                signaling.sendOffer(off)
              })
              socket.connect().then(() => {
                this.increaseOccurences(neighborId, true).then(() => {
                  resolve(neighborId)
                })
              }).catch(reject)
            }
          } else {
            resolve(neighborId)
          }
        }).catch(e => {
          reject(e)
        })
      })
    }
  }

  increaseOccurences (peerId) {
    console.log(this.livingOutview, this.livingInview)
    return new Promise((resolve, reject) => {
      if (!this.livingOutview.has(peerId)) {
        reject(errors.peerNotFound(peerId))
      } else {
        this.send(peerId, {
          type: events.data.OCC_INC,
          id: this.id
        })
        this.increaseOccOutview(peerId)
        this.emit('connect', peerId)
        resolve()
      }
    })
  }

  increaseOccInview (peerId) {
    this.livingInview.get(peerId).occurences++
  }

  increaseOccOutview (peerId) {
    this.livingOutview.get(peerId).occurences++
  }

  async send (peerId, message) {
    if (this.livingOutview.has(peerId)) {
      return this.livingOutview.get(peerId).socket.send(this._serialize(message))
    } else if (this.livingInview.has(peerId)) {
      return this.livingInview.get(peerId).socket.send(this._serialize(message))
    } else {
      throw errors.peerNotFound(peerId)
    }
  }

  /**
   * Disconnect all or one arc. (todo: minize the connection overhead)
   * @param  {String}  userId [description]
   * @return {Promise}        [description]
   */
  async disconnect (userId) {
    if (userId) {
      if (!this.living.has(userId)) {
        throw errors.peerNotFound(userId)
      } else {
        const p = this.living.get(userId)
        // firstly check outview, if 0 or 1 disconnect, otherwise decrease
        if ((p.outview === 1 && p.inview === 0) || (p.outview === 0 && p.inview === 1)) {
          return new Promise((resolve, reject) => {
            const jobId = translator.new()
            this.send(userId, {
              type: events.data.DISCONNECT_DIRECT,
              id: this.id,
              jobId
            }).catch(reject)
            const timeout = setTimeout(() => {
              this.removeAllListeners(jobId)
              reject(new Error('disconnection timed out. ' + userId))
            }, this.options.neighborhood.timeoutDisconnect)
            this.on(jobId, () => {
              this.living.get(userId).socket.disconnect().then(() => {
                clearTimeout(timeout)
                resolve()
              }).catch(e => {
                clearTimeout(timeout)
                reject(e)
              })
            })
          })
        } else {
          return new Promise((resolve, reject) => {
            // decrease, send message to decrease the inview at the other side and signal when answer
            // now send the mesage and wait for the answer
            const jobId = translator.new()
            this.send(userId, {
              type: events.data.DISCONNECT_REQUEST,
              id: this.id,
              jobId
            })
            // TODO: timeout
            this.on(jobId, () => {
              this.living.get(userId).outview--
              this._signalDisconnect(userId)
              resolve()
            })
          })
        }
      }
    } else {
      const ids = []
      this.living.forEach((v, k) => {
        for (let i = 0; i < v.inview + v.outview; ++i) {
          ids.push(k)
        }
      })
      return ids.reduce((acc, id) => acc.then(() => {
        return new Promise((resolve, reject) => {
          this.disconnect(id).then(() => {
            resolve()
          }).catch(e => {
            console.error(e)
            resolve()
          })
        })
      }), Promise.resolve())
    }
  }

  createNewSocket (options, id, outview = false) {
    const newSocket = new this.options.neighborhood.SocketClass(options)
    this._debug('[%s] new socket created: %s', this.id, newSocket.socketId)
    newSocket.on('data', (data) => {
      this.__receive(id, data)
    })
    newSocket.on('close', () => {
      this._manageClose(id)
    })
    newSocket.on('error', error => {
      this._manageError(error, id)
    })
    if (outview) {
      this.livingOutview.set(id, {
        socket: newSocket,
        occurences: 0
      })
    } else {
      this.livingInview.set(id, {
        socket: newSocket,
        occurences: 0
      })
    }
    return newSocket
  }

  _manageError (error, peerId, reject) {
    console.error('An error occured, direct deconnection of the socket:  ', error)
    if (this.living.has(peerId)) {
      const p = this.living.get(peerId)
      for (let i = 0; i < (p.inview + p.outview); ++i) {
        this._signalDisconnect(peerId)
      }
    }
    if (reject) reject(error)
  }

  _manageClose (peerId) {
    if (this.living.has(peerId)) {
      const p = this.living.get(peerId)
      this.living.delete(peerId)
      for (let i = 0; i < (p.inview + p.outview); ++i) {
        this._signalDisconnect(peerId)
      }
    } else {
      console.log('[socket does not exist] Connection closed', peerId)
    }
  }

  _serialize (data) {
    return JSON.stringify(data)
  }

  _deserialize (data) {
    return JSON.parse(data)
  }

  _signalConnect (id) {
    this.emit('connect', id)
  }
  _signalDisconnect (id) {
    this.emit('close', id)
  }

  __receive (id, data) {
    data = this._deserialize(data)
    console.log('receive: ', id, data)
    if (data && data.type && data.id && data.type === events.data.OCC_INC) {
      this.increaseOccInview(data.id)
    } else {
      this.receiveData(id, data)
    }
  }
}

module.exports = Neighborhood
