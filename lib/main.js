const lmerge = require('lodash.merge')
const errors = require('./errors')
const events = require('./events')
const short = require('short-uuid')
const translator = short()
const EventEmitter = require('events')
const BridgeIO = require('./signaling').bridgeIO
const BridgeOO = require('./signaling').bridgeOO
const BridgeOI = require('./signaling').bridgeOI
const DirectSignaling = require('./signaling').direct
const OfflineSignaling = require('./signaling').offline
const OnlineSignaling = require('./signaling').online
const View = require('./view')

class N2N extends EventEmitter {
  constructor (options) {
    super()
    const id = translator.new()
    this.options = lmerge({
      n2n: {
        protocol: 'n2n',
        id,
        timeout: 10000,
        SocketClass: require('./sockets').simplepeer
      },
      socket: {
        objectMode: false
      },
      signaling: lmerge({ room: 'default', id }, require('./signaling/server/config.json'))
    }, options)
    // debug log
    this._debug = (require('debug'))('n2n:n2n')
    this._debugMessage = (require('debug'))('n2n:message')
    // set the id, pass in option or by default an initialized one
    this.id = this.options.n2n.id
    // just a map for checking if there is more pending than expected.
    this._pending = new Map()
    this._all = new Map()
    // init the pending(inview/outview)
    this.pendingInview = new Map()
    this.pendingOutview = new Map()
    // init the living(inview/outview)
    this.livingInview = new Map()
    this.livingOutview = new View()
    // set an internal event bus
    this.events = new EventEmitter()
    // listeners
    this.on('lock', (id) => {
      this._debug('[%s] a connection has been locked: %s', this.id, id)
    })
    this.on('unlock', (id) => {
      this._debug('[%s] a connection has been unlocked: %s', this.id, id)
    })
    this.on(this.options.n2n.protocol, (id, message) => {
      this._debugMessage('[%s/%s] receive a message from %s:', this.id, this.options.n2n.protocol, id, message)
      this._receive(id, message)
    })
    // set all signaling services
    this.signaling = {
      bridgeIO: new BridgeIO(this.options.signaling, this),
      bridgeOO: new BridgeOO(this.options.signaling, this),
      bridgeOI: new BridgeOI(this.options.signaling, this),
      direct: new DirectSignaling(this.options.signaling, this),
      offline: new OfflineSignaling(this.options.signaling, this),
      online: new OnlineSignaling(this.options.signaling, this)
    }
  }
  /**
   * Connect us to a neighbor using a signaling service, if neighbor is null we use an online signaling service to connect the neighbor to an already existing network. If we are alone, meaning that the peer id we receive using the signaling service is null, we are automatically connected. If the neighbor is an instance of N2N, we directly connect them through an offline signaling service.
   * @param  {N2N}  neighbor                          N2N instance we want to connect to directly
   * @param  {Signaling}  [signaling=this.signaling.online] The online service we want to use. Dont forget to active the listener to receive incoming messages
   * @return {Promise} This method is resolved when the connection is successfully done, otherwise rejected
   */
  async connect (neighbor, signaling = this.signaling.online) {
    if (neighbor) {
      if (this.livingOutview.has(neighbor.id)) {
        return this.increaseOccurences(neighbor.id).then(() => {
          return neighbor.id
        })
      } else if (!this.pendingOutview.has(neighbor.id)) {
        return new Promise(async (resolve, reject) => {
          signaling = this.signaling.offline
          await signaling.connect()
          const jobId = translator.new()
          const socket = this.createNewSocket(this.options.socket, neighbor.id, true)
          socket.on('error', (error) => {
            this._manageError(error, neighbor.id, true, reject)
          })
          socket.on(events.socket.EMIT_OFFER, (offer) => {
            neighbor.signaling.offline.receiveOffer({
              jobId,
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
            resolve(neighbor.id)
            // neighbor.signaling.offline.removeListener(events.signaling.EMIT_OFFER)
          }).catch(e => {
            reject(e)
          })
        })
      } else {
        return Promise.reject(new Error('The connection is already pending. Retry after the first connection was created.'))
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
            } else if (!this.pendingOutview.has(neighborId)) {
              const jobId = translator.new()
              const socket = this.createNewSocket(this.options.socket, neighborId, true)
              socket.on('error', (error) => {
                this._manageError(error, neighborId, true, reject)
              })
              socket.on(events.socket.EMIT_OFFER, (offer) => {
                const off = {
                  jobId,
                  initiator: this.id,
                  destination: neighborId,
                  offer,
                  type: 'new'
                }
                signaling.sendOffer(off)
              })
              socket.connect().then(() => {
                resolve(neighborId)
              }).catch(reject)
            } else {
              return Promise.reject(new Error('The connection is already pending. Retry after the first connection was created.'))
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
   * Perform connections using existing connection or create new one using a bridge connection.
   * null means us
   * 'from' is null and 'to' is null: error
   * 'from' is null and 'to' is string: add an outview occurence (an arc)
   * 'to' is null and 'from' is string: add an outview from 'from'
   * 'from' is string and 'to' is string: bridge, add an arc (or create the connection) between 'from' and 'to' exchanging offers through us (not using a signaling server)
   *  For the bridge: 'from' and 'to' needs to be in our outview.
   *  For more choice, use bridgeIO or bridgeOI respectively bridge inview to outview and bridge outview to inview
   * @param  {String|null}  [from=null] peer id
   * @param  {String|null}  [to=null]   peer id
   * @return {Promise} resolved if the promise of chosen case is resolved, otherwise reject with the appropriate method
   */
  async connect4u (from = null, to = null) {
    if (from === this.id) from = null
    if (to === this.id) to = null
    if (from && typeof from === 'string' && to && typeof to === 'string') {
      this._debug('[%s] %s -bridgeIO> %s !', this.id, from, to)
      return this.bridgeOO(from, to)
    } else if (from && typeof from === 'string' && to === null) {
      // from to to us
      this._debug('[%s] %s -> %s !', this.id, from, this.id)
      return this.connectToUs(from)
    } else if (to && typeof to === 'string' && from === null) {
      // connection from us to to
      if (this.livingOutview.has(to)) {
        this._debug('[%s] %s -> %s !', this.id, this.id, to)
        return this.connectFromUs(to)
      } else {
        return Promise.reject(new Error(to + ' need to be in our outview.'))
      }
    } else {
      return Promise.reject(errors.nyi())
    }
  }

  /**
   * Add outview connection to the peer specified by peerId (use an existing connection for that.)
   * @param  {String}  peerId peer id to connect with
   * @return {Promise} Resolve when successfully established. Rject otherwise
   */
  async connectFromUs (peerId, outview = true) {
    return this.increaseOccurences(peerId, true)
  }

  /**
   * Ask to the peer identified by peerId to establish a connection with us. It add an arc from its outview to our inview.
   * To not lock the connection forever the function will timeout after the timeout specified in the function (also in options)
   * So if the connection timed out and the connection is well established.
   * Good to luck to find a way to solve your problem. (set a bigger timeout (-_-))
   * @param  {String}  peerId id of the peer that will establish the connection
   * @return {Promise} Resolve when the connection is successfully established. Reject otherwise, error or timeout, or peer not found.
   */
  async connectToUs (peerId, timeout = this.options.n2n.timeout) {
    return this.signaling.direct.connectToUs(peerId, timeout)
  }

  /**
   * Perform a bridge without locking any connection, this is your responsability to lock connections correctly.
   * From (inview) to dest (outview)
   * @param  {String}  from peer id (initiator)
   * @param  {String}  dest   peer id (destination)
   * @param  {Number} [timeout=this.options.n2n.timeout] time to wait before rejecting.
   * @return {Promise}
   */
  async bridgeIO (from, dest, timeout = this.options.n2n.timeout) {
    return this.signaling.bridgeIO.bridge(from, dest, timeout)
  }
  /**
   * Perform a bridge without locking any connection, this is your responsability to lock connections correctly.
   * From (outview) to dest (inview)
   * @param  {String}  from peer id (initiator)
   * @param  {String}  dest   peer id (destination)
   * @param  {Number} [timeout=this.options.n2n.timeout] time to wait before rejecting.
   * @return {Promise}
   */
  async bridgeOI (from, dest, timeout = this.options.n2n.timeout) {
    return this.signaling.bridgeOI.bridge(from, dest, timeout)
  }
  /**
   * Perform a bridge without locking any connection, this is your responsability to lock connections correctly.
   * From (outview) to dest (outview)
   * @param  {String}  from peer id (initiator)
   * @param  {String}  dest   peer id (destination)
   * @param  {Number} [timeout=this.options.n2n.timeout] time to wait before rejecting.
   * @return {Promise}
   */
  async bridgeOO (from, dest, timeout = this.options.n2n.timeout) {
    return this.signaling.bridgeOO.bridge(from, dest, timeout)
  }

  /**
   * @description Send a message to the peer specified.
   * Firstly we try to send in the outview, then we try to send the message in the inview.
   * Then we throw an error if the peer is not found in the outview nor the inview.
   * @param  {String}  [protocol= 'receive'] Protocol (event) used to send the message, on receive the message will be emitted on this event
   * @param  {String}  peerId  peer id we want to send the message to
   * @param  {Object}  message Message to send
   * @param {Boolean}  [outview=true] Define where to get the socket for sending the message, on the outview or inview
   * @return {Promise} Promise resolved when the message is sent, reject if the peer is not found or an error is return from the send method of the socket used.
   */
  async send (protocol = 'receive', id, msg, outview = true) {
    const message = { protocol, msg }
    if (outview) {
      return this._sendOutview(id, message)
    } else if (!outview) {
      return this._sendInview(id, message)
    }
  }
  async _sendInview (peerId, message) {
    if (this.livingInview.has(peerId)) {
      this._debugMessage('[%s/n2n] sending a message on the inview to:  %s', this.id, peerId, message)
      return this.livingInview.get(peerId).socket.send(this._serialize(message))
    } else {
      throw new Error('[' + this.id + '] Peer not found in the inview: ' + peerId)
    }
  }
  async _sendOutview (peerId, message) {
    if (this.livingOutview.has(peerId)) {
      this._debugMessage('[%s/n2n] sending a message on the outview to:  %s', this.id, peerId, message)
      return this.livingOutview.get(peerId).socket.send(this._serialize(message))
    } else {
      throw new Error('[' + this.id + '] Peer not found in the outview: ' + peerId)
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
        throw new Error('peer not found in the outview')
      } else {
        const p = this.livingOutview.get(userId)
        if (p.occurences === 0) {
          throw new Error('Occurences = 0, Maybe the peer is already being disconnected.')
        } else {
          if (this.livingOutview.available(userId)) {
            return this.decreaseOccOutview(userId)
          } else {
            throw new Error('Peer not available, because connections are locked.')
          }
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
   * Lock an outview connection by incrementing the lock value of a socket
   * @param  {String}  peerId peer id to lock
   * @return {Boolean} False if not locked, true when locked.
   */
  lock (peerId) {
    if (!this.livingOutview.has(peerId)) {
      return errors.peerNotFound(peerId)
    } else if (this.livingOutview.available(peerId)) {
      this.livingOutview.get(peerId).lock++
      this.emit('lock-' + peerId)
      this.emit('lock', peerId)
      return true
    } else {
      throw new Error(`[${this.id}] cannot lock this connection id= ${peerId}, not available, (lock= ${this.livingOutview.get(peerId).lock} and occurences= ${this.livingOutview.get(peerId).occurences})`)
    }
  }

  /**
   * Unlock an outview connection by decrementing the lock value of a socket
   * @param  {String}  peerId peer id to unlock
   * @return {Boolean} False if not unlocked, true when unlocked.
   */
  unlock (peerId) {
    if (!this.livingOutview.has(peerId)) {
      throw new Error(`[${this.id}] cannot unlock a connection that does not exist. id=${peerId}`)
    } else {
      const p = this.livingOutview.get(peerId)
      if (p.lock > 0 && p.occurences > 0 && p.socket.status === 'connected') {
        this.livingOutview.get(peerId).lock--
        this.emit('unlock-' + peerId)
        this.emit('unlock', peerId)
        return true
      } else {
        throw new Error(`[${this.id}] cannot unlock a connection under the status ${p.socket.status}, (lock= ${p.lock} and occurences= ${p.occurences}), not locked!`)
      }
    }
  }

  /**
   * @description Increase the occurence of the socket in the outview and send a message to the peer connected with to increase its inview
   * @param  {String} peerId [description]
   * @return {Promise}        [description]
   */
  increaseOccurences (peerId) {
    return new Promise((resolve, reject) => {
      if (!this.livingOutview.has(peerId)) {
        reject(errors.peerNotFound(peerId))
      } else {
        this.livingOutview.get(peerId).occurences++
        this._signalConnect(peerId, true)
        resolve()
      }
    })
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
      if ((p.lock > 0 && p.occurences === 0)) {
        throw new Error('lock cannot be higher than the number of occurences when a deletion is performed.')
      } else if (p.occurences > 0 && p.occurences > p.lock) {
        this.livingOutview.get(peerId).occurences--
        if (this.livingOutview.get(peerId).occurences === 0) {
          this._signalDisconnect(peerId, true)
          return p.socket.disconnect()
        } else {
          this._signalDisconnect(peerId, true) // signal disconnect
        }
      } else {
        throw new Error('PLEASE REPORT: decreaseOccOutview')
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
  createNewSocket (options, id, outview = false, timeout = this.options.n2n.timeout) {
    const newSocket = new this.options.n2n.SocketClass(options)
    const sid = newSocket.socketId
    // const s = {
    //   from: this.id,
    //   to: id,
    //   socket: newSocket
    // }
    // this._pending.set(sid, s)
    // this._all.set(sid, s)
    this._debug('[%s] new socket created: %s with timeout', this.id, newSocket.socketId, timeout)
    const tout = setTimeout(() => {
      // deletion, the sid need to be the same as declared... otherwise report this error.
      if (!outview) {
        if (this.pendingInview.get(id).socket.socketId === sid) {
          // this.pendingInview.delete(id)
          this._deletePending(id, outview)
        } else {
          console.error(new Error('SID not equaled. Please report this error.'))
        }
      } else {
        if (this.pendingOutview.get(id).socket.socketId === sid) {
          // this.pendingOutview.delete(id)
          this._deletePending(id, outview)
        } else {
          console.error(new Error('SID not equaled. Please report this error.'))
        }
      }
    }, timeout)
    newSocket.status = 'connecting'
    newSocket.once('connect', () => {
      this._pending.delete(sid)
      clearTimeout(tout)
      if (!outview) {
        // this.pendingInview.delete(id)
        this._deletePending(id, outview)
        this.livingInview.set(id, {
          socket: newSocket,
          occurences: 1,
          lock: 0
        })
        this._signalConnect(id, false)
      } else {
        // this.pendingOutview.delete(id)
        this._deletePending(id, outview)
        this.livingOutview.set(id, {
          socket: newSocket,
          occurences: 1,
          lock: 0
        })
        this._signalConnect(id, true)
      }
    })
    newSocket.on('data', (data) => {
      this.__receive(id, data)
    })
    newSocket.once('close', (socketId) => {
      this._manageClose(id, outview, socketId)
    })
    newSocket.once('error', error => {
      this._manageError(error, id, outview)
    })
    if (outview) {
      this.pendingOutview.set(id, {
        socket: newSocket,
        occurences: 0,
        lock: 0
      })
    } else {
      this.pendingInview.set(id, {
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
   * @param  {function}  reject         reject callback (used in the connection function)
   * @return {void}
   */
  _manageError (error, peerId, outview = false, reject) {
    // chrome fix for disconnection
    if (error.message === 'Ice connection failed.') {
      this._debug('Chrome disconnection: ', peerId, error)
    } else {
      this._debug(`[%s] Error of the socket: (%s), this is just a log. The error is catched. [reject:${typeof reject}]`, this.id, peerId, error)
    }
    if (reject) {
      // if pending reject the connection
      reject(error)
    }
  }

  /**
   * @description On connection closed, signal if its an inview or an outview arc. Remove the socket from its (in/out)view.
   * @param  {String}  peerId          id of the peer
   * @param  {Boolean} [outview=false] is in the outview or not
   * @param  {String} socketId Identifier of the socket
   * @return {void}
   */
  _manageClose (peerId, outview = false, socketId) {
    if (outview && this.livingOutview.has(peerId)) {
      const p = this.livingOutview.get(peerId)
      // check if it is the same socketId
      if (p.socket.socketId === socketId) {
        this._debug('[%s] close outview: ', this.id, peerId, outview, p)
        for (let i = 0; i < (p.occurences); ++i) {
          this._signalDisconnect(peerId, outview)
        }
        this._deleteLiving(peerId, outview)
      } // else, nothing to do
    } else if (!outview && this.livingInview.has(peerId)) {
      const p = this.livingInview.get(peerId)
      if (p.socket.socketId === socketId) {
        this._signalDisconnect(peerId, outview)
        this._debug('[%s] close inview: ', this.id, peerId, outview)
        this._deleteLiving(peerId, outview)
      }
    } else {
      console.log('[socket does not exist] Connection closed', peerId)
    }
  }

  _deleteLiving (id, outview) {
    if (outview) {
      this._debug('[%s] deleting outview living entry:', this.id, id)
      this.livingOutview.delete(id)
    } else {
      this._debug('[%s] deleting inview living entry:', this.id, id)
      this.livingInview.delete(id)
    }
  }

  _deletePending (id, outview) {
    if (outview) {
      this._debug('[%s] deleting outview pending entry:', this.id, id)
      this.pendingOutview.delete(id)
    } else {
      this._debug('[%s] deleting inview pending entry:', this.id, id)
      this.pendingInview.delete(id)
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
  _signalConnect (id, outview = false) {
    if (outview) {
      this.emit('out', id, true)
    } else {
      this.emit('in', id, false)
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
    try {
      data = this._deserialize(data)
      this.emit(data.protocol, id, data.msg)
    } catch (e) {
      console.error(new Error('Impossible to parse data: ' + e.message), id, data)
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
      if (v.occurences > 0 && v.socket.status === 'connected') {
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
      res.push({ peer, id })
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

  _receive (id, message) {
    try {
      if (message && 'type' in message && 'id' in message && message.type === events.n2n.CONNECT_TO_US) {
        this.signaling.direct._connectToUs(message)
      } else if (message && 'type' in message && 'response' in message && message.type === events.n2n.RESPONSE) {
        this.events.emit(message.jobId, message)
      } else if (message && 'type' in message && message.type === events.n2n.DIRECT_TO) {
        this.signaling.direct.receiveOffer(message)
      } else if (message && 'type' in message && message.type === events.n2n.DIRECT_BACK) {
        this.signaling.direct.receiveOffer(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeIO.BRIDGE) {
        this.signaling.bridgeIO._bridge(id, message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeIO.BRIDGE_FORWARD) {
        this.signaling.bridgeIO.forward(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeIO.BRIDGE_FORWARD_BACK) {
        this.signaling.bridgeIO.forwardBack(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeIO.BRIDGE_FORWARD_RESPONSE) {
        this.signaling.bridgeIO.receiveOffer(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeOO.BRIDGE) {
        this.signaling.bridgeOO._bridge(id, message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeOO.BRIDGE_FORWARD) {
        this.signaling.bridgeOO.forward(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeOO.BRIDGE_FORWARD_BACK) {
        this.signaling.bridgeOO.forwardBack(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeOO.BRIDGE_FORWARD_RESPONSE) {
        this.signaling.bridgeOO.receiveOffer(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeOI.BRIDGE) {
        this.signaling.bridgeOI._bridge(id, message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeOI.BRIDGE_FORWARD) {
        this.signaling.bridgeOI.forward(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeOI.BRIDGE_FORWARD_BACK) {
        this.signaling.bridgeOI.forwardBack(message)
      } else if (message && 'type' in message && message.type === events.n2n.bridgeOI.BRIDGE_FORWARD_RESPONSE) {
        this.signaling.bridgeOI.receiveOffer(message)
      }
    } catch (e) {
      console.error('An error here? hum please report...', e)
    }
  }
}

module.exports = N2N
