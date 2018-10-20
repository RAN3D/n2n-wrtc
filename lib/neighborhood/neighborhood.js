const short = require('short-uuid')
const translator = short()
const lmerge = require('lodash.merge')
const OfflineSignaling = require('../signaling').offline
const OnlineSignaling = require('../signaling').online
const events = require('../events')
const errors = require('../errors')
const EventEmitter = require('events')

/**
 * @class
 * @classdesc Neighborhood class, it contains a list of sockets. These sockets are direct neighbors of this class.
 * it allows offline connection and online connections
 * @extends Neighborhood
 */
class Neighborhood extends EventEmitter {
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
    super()
    this._debug = (require('debug'))('n2n:neighborhood')
    this.options = options
    this.__view = (require('./view'))
    const ViewClass = this.__view
    this.livingInview = new ViewClass()
    this.livingOutview = new ViewClass()
    this._debug('Options set: ', this.options)
    this.id = this.options.neighborhood.id
    this.signaling = {
      offline: new OfflineSignaling(this.options.signaling),
      online: new OnlineSignaling(this.options.signaling)
    }
    this.on('lock', (id) => {
      console.log('[%s] a connection has been locked: %s', this.id, id)
    })
    this.on('unlock', (id) => {
      console.log('[%s] a connection has been unlocked: %s', this.id, id)
    })
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

  /**
   * Connect us to a neighbor using a signaling service, if neighbor is null we use an online signaling service to connect the neighbor to an already existing network. If we are alone, meaning that the peer id we receive using the signaling service is null, we are automatically connected. If the neighbor is an instance of Neighborhood, we directly connect them through an offline signaling service.
   * @param  {Neighborhood}  neighbor                          Neighborhood instance we want to connect to directly
   * @param  {Signaling}  [signaling=this.signaling.online] The online service we want to use. Dont forget to active the listener to receive incoming messages
   * @return {Promise} This method is resolved when the connection is successfully done, otherwise rejected
   */
  async connect (neighbor, signaling = this.signaling.online) {
    // get peers id and check if we already have the neighbor connection
    // yes? => increment occurences
    // no? => create it
    if (neighbor) {
      if (this.livingOutview.has(neighbor.id)) {
        return this.increaseOccurences(neighbor.id).then(() => {
          // we only send the message in case when the connection is already here
          return this.send(neighbor.id, {
            type: events.neighborhood.OCC_INC,
            id: this.id
          }).then(() => {
            return neighbor.id
          })
        })
      } else {
        signaling = this.signaling.offline
        return new Promise(async (resolve, reject) => {
          await signaling.connect()
          const socket = this.createNewSocket(this.options.socket, neighbor.id, true)
          socket.on('error', (error) => {
            this._manageError(error, neighbor.id, true, reject)
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
                this.send(neighborId, {
                  type: events.neighborhood.OCC_INC,
                  id: this.id
                }).then(() => {
                  resolve(neighborId)
                }).catch(e => {
                  reject(e)
                })
              }).catch(e => {
                reject(e)
              })
            } else {
              const socket = this.createNewSocket(this.options.socket, neighborId, true)
              socket.on('error', (error) => {
                this._manageError(error, neighborId, true, reject)
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

  /**
   * Lock an outview connection by incrementing the lock value of a socket
   * @param  {String}  peerId peer id to lock
   * @return {Boolean} False if not locked, true when locked.
   */
  lock (peerId) {
    if (!this.livingOutview.has(peerId)) {
      return false
    } else {
      const p = this.livingOutview.get(peerId)
      if (p.lock >= p.occurences || p.occurences <= 0 || p.lock < 0) {
        return false
      } else {
        this.livingOutview.get(peerId).lock++
        this.emit('lock-' + peerId)
        this.emit('lock', peerId)
        return true
      }
    }
  }

  /**
   * Unlock an outview connection by decrementing the lock value of a socket
   * @param  {String}  peerId peer id to unlock
   * @return {Boolean} False if not unlocked, true when unlocked.
   */
  unlock (peerId) {
    if (!this.livingOutview.exist(peerId)) {
      return false
    } else {
      const p = this.livingOutview.get(peerId)
      if (p.lock > 0 && p.occurences > 0 && p.lock <= p.occurences) {
        this.livingOutview.get(peerId).lock--
        this.emit('unlock-' + peerId)
        this.emit('unlock', peerId)
        return true
      } else {
        return false
      }
    }
  }

  /**
   * @description Increase the occurence of the socket in the outview and send a message to the peer connected with to increase its inview
   * @param  {String} peerId [description]
   * @return {void}        [description]
   */
  async increaseOccurences (peerId) {
    if (!this.livingOutview.has(peerId)) {
      throw errors.peerNotFound(peerId)
    } else {
      this.increaseOccOutview(peerId)
    }
  }
  /**
   * @description Increase the occurence of the socket specified by its id in the inview
   * @param  {String} peerId peer id
   * @return {void}
   */
  increaseOccInview (peerId) {
    this.livingInview.get(peerId).occurences++
    this._signalConnect(peerId, false)
  }
  /**
   * @description Increase the occurence of the socket specified by its id in the outview
   * @param  {String} peerId peer id
   * @return {void}
   */
  increaseOccOutview (peerId) {
    if (!this.livingOutview.has(peerId)) {
      console.log(new Error('[decreaseOccOutview] This error should never happen. Please report.'))
    } else {
      this.livingOutview.get(peerId).occurences++
      this._signalConnect(peerId, true)
    }
  }
  /**
   * @description Decrease the local inview.
   * Also emit a disconnect signal after decreasing the inview
   * @param  {String}  peerId          id of the peer that we want to decrease the inview
   * @param  {Boolean} [outview=false] if outview or not
   * @return {void}
   */
  decreaseOccInview (peerId, outview = false) {
    if (!this.livingInview.has(peerId)) {
      console.log(new Error('[decreaseOccInview] This error should never happen. Please report.'))
    } else {
      this.livingInview.get(peerId).occurences--
      this._signalDisconnect(peerId, outview)
    }
  }

  /**
   * @description Decrease the local outview of the conenction specified by the peer id
   * Also send a message to the remote peer to decrease its according inview for the socket connected with.
   * @param  {String}  peerId peer id of the connection we want to decrease the occurence
   * @return {Promise} Promise resolved when the dec is done or the real disconnection of the physical link
   */
  async decreaseOccOutview (peerId) {
    if (!this.livingOutview.has(peerId)) {
      throw errors.peerNotFound(peerId)
    } else {
      const p = this.livingOutview.get(peerId)
      if (p.occurences === 0) {
        // try to remove the connection
        p.socket.disconnect()
        throw new Error('The peer cant be at occurences=0 in this phase, please report this error.')
      } else {
        // now decrease
        this.send(peerId, {
          type: events.neighborhood.OCC_DEC,
          id: this.id
        }).then(() => {
          this.livingOutview.get(peerId).occurences--
          this._signalDisconnect(peerId, true)
          if (p.occurences === 0) {
            return p.socket.disconnect()
          }
        }).catch(e => {
          return Promise.reject(e)
        })
      }
    }
  }

  /**
   * @description Send a message to the peer specified.
   * Firstly we try to send in the outview, then we try to send the message in the inview.
   * Then we throw an error if the peer is not found in the outview nor the inview.
   * @param  {String}  peerId  peer id we want to send the message to
   * @param  {Object}  message Message to send
   * @return {Promise} Promise resolved when the message is sent, reject if the peer is not found or an error is return from the send method of the socket used.
   */
  async send (peerId, message) {
    if (this.livingOutview.exist(peerId) && this.livingOutview.get(peerId).socket.status === 'connected') {
      return this.livingOutview.get(peerId).socket.send(this._serialize(message))
    } else if (this.livingInview.exist(peerId) && this.livingInview.get(peerId).socket.status === 'connected') {
      return this.livingInview.get(peerId).socket.send(this._serialize(message))
    } else {
      throw errors.peerNotFound(peerId)
    }
  }

  /**
   * @description Disconnect all or one arc.
   * @param  {String}  userId [description]
   * @return {Promise}        [description]
   */
  async disconnect (userId) {
    if (userId) {
      if (!this.livingOutview.has(userId)) {
        throw errors.peerNotFound(userId)
      } else {
        const p = this.livingOutview.get(userId)
        if (p.occurences === 0) {
          throw new Error('No connection found. Maybe the peer is being disconnected.')
        }
        // check if occurences - lock is > 0
        const available = (p.occurences - p.lock) > 0
        if (available) {
          return this.decreaseOccOutview(userId)
        } else {
          throw new Error('Peer not available, because connections are locked.')
        }
      }
    } else {
      const ids = []
      this.livingOutview.forEach((v, k) => {
        for (let i = 0; i < (v.occurences - v.lock); ++i) {
          ids.push(k)
        }
      })
      if (ids.length === 0) {
        throw new Error('No peers to disconnect')
      } else {
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
  }

  /**
   * Simulate a crash by disconnecting all sockets from inview/outview
   * @return {void}
   */
  crash () {
    this.livingOutview.forEach(p => {
      p.socket.disconnect()
    })
    this.livingInview.forEach(p => {
      p.socket.disconnect()
    })
  }

  /**
   * @description Create a new Socket and initialize callbacks (message/error/close)
   * @param  {Object}  options         options to pass to the newly created socket.
   * @param  {String}  id              id of our new neighbor
   * @param  {Boolean} [outview=false] if it is an inview or outview sockt
   * @return {Socket}
   */
  createNewSocket (options, id, outview = false) {
    const newSocket = new this.options.neighborhood.SocketClass(options)
    this._debug('[%s] new socket created: %s', this.id, newSocket.socketId)
    newSocket.once('connect', () => {
      if (!outview) {
        this.increaseOccInview(id, outview)
      }
    })
    newSocket.on('data', (data) => {
      this.__receive(id, data)
    })
    newSocket.once('close', () => {
      this._manageClose(id, outview)
    })
    newSocket.once('error', error => {
      this._manageError(error, id, outview)
    })
    if (outview) {
      this.livingOutview.set(id, {
        socket: newSocket,
        occurences: 0,
        lock: 0
      })
    } else {
      this.livingInview.set(id, {
        socket: newSocket,
        occurences: 0,
        lock: 0
      })
    }
    return newSocket
  }

  /**
   * @description On error received, disconnect the (in/out)view socket. Reject with the error provided if the reject parameter is passed.
   * @param  {Error}  error           The error received
   * @param  {String}  peerId          Id of the peer that is errored
   * @param  {Boolean} [outview=false] (In/out)view
   * @param  {function}  reject          callback reject (used in the connection function)
   * @return {void}
   */
  _manageError (error, peerId, outview = false, reject) {
    console.log('Error of the socket: (%s) (outview:' + outview + ') this is just a log. The error is catched.', peerId, error)
    if (outview && this.livingOutview.has(peerId)) {
      this.livingOutview.get(peerId).socket.disconnect()
    } else if (!outview && this.livingInview.has(peerId)) {
      this.livingInview.get(peerId).socket.disconnect()
    }
    if (reject) reject(error)
  }

  /**
   * @description On connection closed, signal if its an inview or an outview arc. Remove the socket from its (in/out)view.
   * @param  {String}  peerId          id of the peer
   * @param  {Boolean} [outview=false] is in the outview or not
   * @return {void}
   */
  _manageClose (peerId, outview = false) {
    if (outview && this.livingOutview.has(peerId)) {
      const p = this.livingOutview.get(peerId)
      this.livingOutview.delete(peerId)
      for (let i = 0; i < (p.occurences); ++i) {
        this._signalDisconnect(peerId, outview)
      }
    } else if (!outview && this.livingInview.has(peerId)) {
      const p = this.livingInview.get(peerId)
      this.livingInview.delete(peerId)
      for (let i = 0; i < (p.occurences); ++i) {
        this._signalDisconnect(peerId, outview)
      }
    } else {
      console.log('[socket does not exist] Connection closed', peerId)
    }
  }

  /**
   * @description Serialize the data before sending it
   * @param  {Object} data data not serialized
   * @return {Object} Serialized data
   */
  _serialize (data) {
    return JSON.stringify(data)
  }
  /**
   * @description Deserialize data when received
   * @param  {string} data data received
   * @return {Object} Data parsed
   */
  _deserialize (data) {
    return JSON.parse(data)
  }
  /**
   * @description Signal when an arc is opened, if its an inview arc, increase the occurence
   * Do not increment the occurence in the outview if it is an outview arc because it is manually controlled during the connection
   * @param  {string} id Id of the peer of the arc
   * @param  {Boolean} outview Is an inview or an outview arc
   * @return {void}
   */
  _signalConnect (id, outview) {
    if (outview) {
      this.emit('out', id, outview)
    } else {
      this.emit('in', id, outview)
    }
  }
  /**
   * @description Signal when an arc is closed
   * @param  {string} id Id of the peer of the arc
   * @param  {Boolean} outview Is an inview or an outview arc
   * @return {void}
   */
  _signalDisconnect (id, outview) {
    if (outview) {
      this.emit('close_out', id, outview)
    } else {
      this.emit('close_in', id, outview)
    }
  }

  /**
   * @description Callback called when we receive a message from a socket
   * @param  {String} id   id of the peer
   * @param  {Object} data data received
   * @return {void}
   */
  __receive (id, data) {
    data = this._deserialize(data)
    if (data && data.type && data.id && data.type === events.neighborhood.OCC_DEC) {
      this.decreaseOccInview(data.id)
    } else if (data && data.type && data.id && data.type === events.neighborhood.OCC_INC) {
      this.increaseOccInview(data.id)
    } else {
      this.emit('receive', id, data)
    }
  }

  /**
   * @description Get all reachable neighbours including socket, occurences, lock and ids
   * If the connection is totally locked you cant see it.
   * @param {Boolean} [all=false] if true, return all neighbours even if they are locked
   * @return {Array<Object>} Array of object [{peer: {socket, occurences, lock}, id}]
   */
  getNeighbours (all = false) {
    if (all) {
      return this.getAllNeighbours()
    } else {
      return this.getNeighboursOutview()
    }
  }
  /**
   * @description Get all reachable neighbours including socket, occurences, lock and ids
   * Even if the connection is totally locked you can see it
   * @return {Array<Object>} Array of object [{peer: {socket, occurences, lock}, id}]
   */
  getAllNeighbours () {
    const res = []
    this.livingOutview.forEach((v, k) => {
      if (v.occurences > 0) {
        res.push({
          peer: v,
          id: k
        })
      }
    })
    return res
  }

  /**
   * @description Return all ids of reachable peers (outview)
   * @param {Boolean} [all=false] if true, return all neighbours even if they are locked
   * @return {Array<String>}
   */
  getNeighboursIds (all = false) {
    return this.getNeighbours(all).map(p => p.id)
  }

  /**
   * @description Get the list of all outviews sockets including occurences and lock and the peer id connected with.
   * Contrary to your inview, Occurences and lock are consistent because you have the control on your outview
   * @return {Array<Object>} Array of object [{peer: {socket, occurences, lock}, id}]
   */
  getNeighboursOutview () {
    const res = []
    this.livingOutview.forEach((peer, id) => {
      if ((peer.occurences - peer.lock) > 0) res.push({ peer, id })
    })
    return res
  }

  /**
   * @description Get the list of all inviews sockets including occurences and the peer id connected with.
   * (Warning) occurences and lock are inconsistent because you have no control on your inview
   * @return {Array<Object>} Array of object [{peer: {socket, occurences, lock}, id}]
   */
  getNeighboursInview () {
    const res = []
    this.livingInview.forEach((peer, id) => {
      res.push({ peer, id })
    })
    return res
  }

  /**
   * @description Return a list of arcs inview/outview for the peer in an array of object {source: <string>, dest: <string>, outview: <boolean>} even if they are lock or not
   * @return {ObjectArray<Object>} [{source: <string>, dest: <string>, outview: <boolean>}, ...]
   */
  getArcs () {
    const res = []
    this.livingInview.forEach((p, k) => {
      for (let i = 0; i < p.occurences; ++i) {
        res.push({
          source: this.id,
          target: k,
          outview: false
        })
      }
    })
    this.livingOutview.forEach((p, k) => {
      for (let i = 0; i < p.occurences; ++i) {
        res.push({
          source: this.id,
          target: k,
          outview: true
        })
      }
    })
    return res
  }
}

module.exports = Neighborhood
