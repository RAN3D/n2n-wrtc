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
      if (!this.living.has(initiator) && type === 'new') {
        // we do have the socket for the moment, create it
        const socket = this.createNewSocket(this.options.socket, initiator)
        // const socket = this.createNewSocket(lmerge(this.options.socket, { initiator: false }), initiator)
        this.living.set(initiator, {
          socket,
          inview: 0,
          outview: 0
        })
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.living.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.offline.sendOffer({
            initiator,
            destination,
            offer: socketOffer,
            type: 'back'
          })
        })
        // this.living.get(initiator).socket.on('connect', () => {
        //   this._debug('Peer %s is online', initiator)
        // })
        this.living.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (type === 'new') {
          try {
            this.living.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (type === 'back') {
          try {
            this.living.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
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
        this.living.set(initiator, {
          socket,
          inview: 0,
          outview: 0
        })
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.living.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.online.sendOffer({
            initiator,
            destination,
            offer: socketOffer,
            type: 'back'
          })
        })
        // this.living.get(initiator).socket.on('connect', () => {
        //   this._debug('Peer %s is online', initiator)
        // })
        this.living.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (type === 'new') {
          try {
            this.living.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (type === 'back') {
          try {
            this.living.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
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
      if (this.living.get(neighbor.id)) {
        return this.increaseOutview(neighbor.id).then(() => {
          return neighbor.id
        })
      } else {
        signaling = this.signaling.offline
        return new Promise(async (resolve, reject) => {
          await signaling.connect()
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

          this.living.set(neighbor.id, {
            socket,
            inview: 0,
            outview: 0
          })
          // this.inview.set(neighbor.id)

          socket.connect().then(() => {
            // console.log('[%s/offline] socket connected.', this.id)
            this.increaseOutview(neighbor.id).then(() => {
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
            if (this.living.get(neighborId)) {
              this.increaseOutview(neighborId).then(() => {
                resolve(neighborId)
              }).catch(e => {
                reject(e)
              })
            } else {
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
                signaling.sendOffer(off)
              })
              this.living.set(neighborId, {
                socket,
                inview: 0,
                outview: 0
              })
              socket.connect().then(() => {
                // console.log('[%s/online] socket connected.', this.id)
                this.increaseOutview(neighborId).then(() => {
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

  increaseOutview (peerId) {
    return new Promise((resolve, reject) => {
      this.living.get(peerId).outview++
      const jobId = translator.new()
      this.send(peerId, {
        type: events.data.INVIEW_REQUEST,
        id: this.id,
        jobId
      })
      this.on(jobId, () => {
        this.emit('connect', peerId)
        resolve()
      })
    })
  }

  async increaseInview (peerId) {
    this.living.get(peerId).inview++
  }

  async decreaseInview (peerId) {
    this.living.get(peerId).inview--
  }

  async send (peerId, message) {
    if (this.living.has(peerId)) return this.living.get(peerId).socket.send(this._serialize(message))
    throw errors.peerNotFound(peerId)
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
          // TODO: timeout
          return new Promise((resolve, reject) => {
            // console.log('disconnect:one:connection')
            const jobId = translator.new()
            this.send(userId, {
              type: events.data.DISCONNECT_DIRECT,
              id: this.id,
              jobId
            }).catch(reject)
            this.on(jobId, () => {
              console.log('receive answer disconnect')
              this.living.get(userId).socket.disconnect().then(() => {
                resolve()
              }).catch(reject)
            })
          })
        } else {
          // console.log('disconnect:decrease:outview')
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
      // console.log('disocnnect:all:connection')
      let promises = []
      const self = this
      this.living.forEach((entry, id) => {
        const p = new Promise((resolve, reject) => {
          // just send a message to say to disconnect before to minimize the overhead
          if (this.living.has(id)) {
            const jobId = translator.new()
            this.on(jobId, () => {
              entry.socket.disconnect().then(() => {
                resolve()
              }).catch(reject)
            })
            self.send(id, {
              type: events.data.DISCONNECT_ALL,
              id: this.id,
              jobId
            })
          }
        })
        promises.push(p)
      })
      return Promise.all(promises)
    }
  }

  createNewSocket (options, id) {
    const newSocket = new this.options.neighborhood.SocketClass(options)
    this._debug('[%s] new socket created: %s', this.id, newSocket.socketId)
    newSocket.on('data', (data) => {
      this.__receive(id, data)
    })
    newSocket.on('close', () => {
      if (this.living.has(id)) {
        const p = this.living.get(id)
        this.living.delete(id)
        for (let i = 0; i < (p.inview + p.outview); ++i) {
          this._signalDisconnect(id)
        }
      }
    })
    return newSocket
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
    if (data && data.type && data.id && data.jobId && data.type === events.data.INVIEW_REQUEST) {
      this.increaseInview(data.id).then(() => {
        this._signalConnect(data.id)
        // console.log('[%s] receive an inview increase request.', this.id)
        this.send(id, {
          type: events.data.INVIEW_ANSWER,
          jobId: data.jobId,
          id: this.id
        })
      }).catch(e => {
        console.error('PLEASE REPORT', e)
      })
    } else if (data && data.type && data.id && data.jobId && data.type === events.data.INVIEW_ANSWER) {
      // console.log('[%s] receive an inview increase answer.', this.id, data)
      this.emit(data.jobId)
    } else if (data && data.type && data.id && data.jobId && data.type === events.data.DISCONNECT_REQUEST) {
      this.decreaseInview(data.id).then(() => {
        // console.log('[%s] receive an inview increase request.', this.id)
        this.send(id, {
          type: events.data.DISCONNECT_ANSWER,
          jobId: data.jobId,
          id: this.id
        }).then(() => {
          this._signalDisconnect(data.id)
        }).catch(e => {
          console.error(new Error('Peer unreachable: ', e))
        })
      }).catch(e => {
        console.error('PLEASE REPORT', e)
      })
    } else if (data && data.type && data.id && data.jobId && data.type === events.data.DISCONNECT_ANSWER) {
      // console.log('[%s] receive an inview increase answer.', this.id, data)
      this.emit(data.jobId)
    } else if (data && data.type && data.id && data.type === events.data.DISCONNECT_DIRECT) {
      // check for the number of inview/outview
      // if it's ok, just disconnect by sending a response
      if (this.living.has(data.id)) {
        const p = this.living.get(data.id)
        // firstly check outview, if 0 or 1 disconnect, otherwise decrease
        if ((p.outview === 1 && p.inview === 0) || (p.outview === 0 && p.inview === 1)) {
          this.send(data.id, {
            type: events.data.DISCONNECT_DIRECT_ANSWER,
            id: this.id,
            jobId: data.jobId
          }).then(() => {
            this.living.get(data.id).socket.disconnect().then(() => {
              return Promise.resolve()
            })
          })
        }
      }
    } else if (data && data.type && data.id && data.jobId && data.type === events.data.DISCONNECT_DIRECT_ANSWER) {
      this.emit(data.jobId)
    } else if (data && data.type && data.id && data.type === events.data.DISCONNECT_ALL) {
      // check for the number of inview/outview
      // if it's ok, just disconnect by sending a response
      console.log('receive direct disconnection requst')
      if (this.living.has(data.id)) {
        // firstly check outview, if 0 or 1 disconnect, otherwise decrease
        this.send(data.id, {
          type: events.data.DISCONNECT_DIRECT_ANSWER,
          id: this.id,
          jobId: data.jobId
        }).then(() => {
          this.living.get(data.id).socket.disconnect().then(() => {
            return Promise.resolve()
          })
        })
      }
    } else if (data && data.type && data.id && data.jobId && data.type === events.data.DISCONNECT_ALL_ANSWER) {
      this.emit(data.jobId)
    } else {
      this.receiveData(id, data)
    }
  }
}

module.exports = Neighborhood
