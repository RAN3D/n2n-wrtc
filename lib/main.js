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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * // offline
   * await a.connect(b)
   * console.log('a is connected to b')
   * @example
   * // Online connection using a signaling server, 'node ./bin/signaling-server.js', server running on the port http://localhost:555/
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * await a.connect()
   * await b.connect()
   * console.log('b is connected to a')
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
            this._manageError(error, neighbor.id, true, reject, 'direct connection')
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
          const func = (offer) => {
            if (offer.jobId === jobId) {
              this.signaling.offline.receiveOffer(offer)
            }
          }
          neighbor.signaling.offline.on(events.signaling.EMIT_OFFER, func)
          socket.connect().then(() => {
            neighbor.signaling.offline.removeListener(events.signaling.EMIT_OFFER, func)
            resolve(neighbor.id)
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
                this._manageError(error, neighborId, true, reject, 'signaling connection')
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
   * @example
   * const N2N = require('n2n-wrtc').n2n
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * const c = new N2N({n2n: {id: 'c'}})
   * await a.connect(b)
   * await a.connect(c)
   * // bridge between b and c because a has b and c in its outview, similar to a.bridgeOO(b.id, c.id)
   * await a.connect4u(b.id, c.id) // create the connection from b to c by exchanging offers through a
   * await a.connect4u(c.id, b.id) // create the connection from c to b by exchanging offers through a
   * // add an arc from us to b, similar to a.connectFromUs(b.id)
   * await a.connect4u(null, b.id)
   * // add a connection from b to us
   * await a.connect4u(b.id, null)
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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * await a.connect(b)
   * await a.connect4u(null, b.id)
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
   * @param  {Number}  [timeout=this.parent.options.n2n.timeout] timeout before time out the connection
   * @param  {Boolean} [outview=true] if true try in to ask in the outview, if false try to send the message on the inview
   * @return {Promise} Resolve when the connection is successfully established. Reject otherwise, error or timeout, or peer not found.
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * await a.connect(b)
   * await a.connect4u(b.id, null)
   */
  async connectToUs (peerId, timeout = this.options.n2n.timeout, outview = true) {
    return this.signaling.direct.connectToUs(peerId, timeout, outview)
  }

  /**
   * Perform a bridge without locking any connection, this is your responsability to lock connections correctly.
   * From (inview) to dest (outview)
   * @param  {String}  from peer id (initiator)
   * @param  {String}  dest   peer id (destination)
   * @param  {Number} [timeout=this.options.n2n.timeout] time to wait before rejecting.
   * @return {Promise}
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * const c = new N2N({n2n: {id: 'c'}})
   * await a.connect(b)
   * await a.connect(c)
   * // bridge between b and c, with b in the inview and c in the outview
   * await a.connect4u(b.id, c.id) // create the connection from b to c by exchanging offers through a
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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * const c = new N2N({n2n: {id: 'c'}})
   * await a.connect(b)
   * await a.connect(c)
   * // bridge between b and c, with b in the outview and c in the inview
   * await a.connect4u(b.id, c.id) // create the connection from b to c by exchanging offers through a
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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * const c = new N2N({n2n: {id: 'c'}})
   * await a.connect(b)
   * await a.connect(c)
   * // bridge between b and c, with both b and c in the outview
   * await a.connect4u(b.id, c.id) // create the connection from b to c by exchanging offers through a
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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * await a.connect(b)
   * b.on('data', (id, message) => {
   *  console.log('b receive the message from %s:', id, message)
   * })
   * a.send('data', b.id, 'Hello world') // send the message Hello world on the event 'data', the message will only be delivered on the peer b on the event 'data' (you can change the value of the event). the message will is only sent on the outview. If you want to change, add an additional argument as "a.send('data', b.id, 'Hello world', false)" for sending the message on the inview.
   */
  async send (protocol = 'receive', id, msg, outview = true) {
    const message = { protocol, msg }
    if (outview) {
      return this._sendOutview(id, message)
    } else if (!outview) {
      return this._sendInview(id, message)
    }
  }
  /**
   * Send a message on the outview
   * @param  {String}  peerId  identifier of the peer
   * @param  {*}  message message to send.
   * @return {Promise}
   * @private
   */
  async _sendInview (peerId, message) {
    if (this.livingInview.has(peerId)) {
      this._debugMessage('[%s/n2n] sending a message on the inview to:  %s', this.id, peerId, message)
      return this.livingInview.get(peerId).socket.send(this._serialize(message))
    } else {
      throw new Error('[' + this.id + '] Peer not found in the inview: ' + peerId)
    }
  }
  /**
   * Send a message on the inview
   * @param  {String}  peerId  identifier of the peer
   * @param  {*}  message message to send.
   * @return {Promise}
   * @private
   */
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
   * @param  {String}  userId identifier of the peer to disconnect.
   * @return {Promise}
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * a.on('close_out', (id, fail) => {
   *  console.log('We are disconnected from %s, fail? %s', id, fail)
   * })
   * b.on('close_in', (id, fail) => {
   *  console.log('%s is disconnected from us', fail? %s', fail)
   * })
   * await a.connect(b)
   * await a.connect(b)
   * // 2 arcs from a to b, a -> b, a -> b
   * // disconnect only one arc from a to b
   * // become: a -> b
   * a.disconnect(b.id)
   * // or for disconnecting all arcs
   * a.disconnect()
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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * await a.connect(b)
   * a.lock(b.id)
   * await a.disconnect(b.id) // throw an error, because the connection is closed.
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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * await a.connect(b)
   * a.lock(b.id)
   * a.unlock(b.id)
   * await a.disconnect(b.id) // allowed.
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
   * @private
   */
  increaseOccurences (peerId) {
    return new Promise((resolve, reject) => {
      if (!this.livingOutview.has(peerId)) {
        reject(errors.peerNotFound(peerId))
      } else {
        this.livingOutview.get(peerId).occurences++
        this.send(this.options.n2n.protocol, peerId, {
          type: events.n2n.INC_IN
        }).then(() => {
          this._signalConnect(peerId, true)
          resolve()
        }).catch(e => {
          console.warn('[%s] cannot send INC_IN message to %s', this.id, peerId)
          this._signalConnect(peerId, true)
          resolve()
        })
      }
    })
  }
  /**
   * @description Decrease the local outview of the conenction specified by the peer id
   * Also send a message to the remote peer to decrease its according inview for the socket connected with.
   * @param  {String}  peerId peer id of the connection we want to decrease the occurence
   * @return {Promise} Promise resolved when the dec is done or the real disconnection of the physical link
   * @private
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
        return this.send(this.options.n2n.protocol, peerId, {
          type: events.n2n.DEC_IN
        }).then(() => {
          if (this.livingOutview.get(peerId).occurences === 0) {
            this._signalDisconnect(peerId, true, false)
            return this.send(this.options.n2n.protocol, peerId, {
              type: events.n2n.DISCONNECT
            }).then(() => {
              return p.socket.disconnect(this.options.socket)
            }).catch(e => {
              return p.socket.disconnect()
            })
          } else {
            this._signalDisconnect(peerId, true, false) // signal disconnect
            return Promise.resolve()
          }
        }).catch(e => {
          console.warn('[%s] cannot send the message to %s', this.id, peerId)
          if (this.livingOutview.get(peerId).occurences === 0) {
            this._signalDisconnect(peerId, true, false)
            return this.send(this.options.n2n.protocol, peerId, {
              type: events.n2n.DISCONNECT
            }).then(() => {
              return p.socket.disconnect()
            }).catch(e => {
              return p.socket.disconnect()
            })
          } else {
            this._signalDisconnect(peerId, true, false) // signal disconnect
            return Promise.resolve()
          }
        })
      } else {
        throw new Error('PLEASE REPORT: decreaseOccOutview')
      }
    }
  }

  /**
   * Decrease the occurences of our inview id
   * @param  {String} id identifier of the peer we want to decrease the occurence
   * @return {void}
   * @private
   */
  _decreaseInview (id) {
    if (this.livingInview.has(id)) {
      this.livingInview.get(id).occurences--
      this._signalDisconnect(id, false, false)
    }
  }
  /**
   * Increase the occurences of our inview id
   * @param  {String} id identifier of the peer we want to decrease the occurence
   * @return {void}
   * @private
   */
  _increaseInview (id) {
    if (this.livingInview.has(id)) {
      this.livingInview.get(id).occurences++
      this._signalConnect(id, false)
    }
  }

  /**
   * Disconnect the living inview socket corresponding to the id provided.
   * @param  {String} id identifier of the peer
   * @return {void}
   * @private
   */
  _disconnectInview (id) {
    if (this.livingInview.has(id)) {
      this.livingInview.get(id).socket.disconnect()
    }
  }

  /**
   * Simulate a crash by disconnecting all sockets from inview/outview
   * @return {void}
   * * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * a.on('close_out', (id, fail) => {
   *  console.log('We are disconnected from %s, fail? %s', id, fail)
   * })
   * b.on('close_in', (id, fail) => {
   *  console.log('%s is disconnected from us', fail? %s', fail)
   * })
   * await a.connect(b)
   * await a.connect(b)
   * a.crash()
   * // b will receive a close_in event with fail equals to true
   * // a will receive a close_out event with fail equals to true
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
   * You have to pass the id of the peer that will be connected to this socket.
   * @param  {Object}  options         options to pass to the newly created socket.
   * @param  {String}  id              id of our new neighbor
   * @param  {Boolean} [outview=false] if it is an inview or outview sockt
   * @return {Socket}
   * @private
   */
  createNewSocket (options, id, outview = false, timeout = this.options.n2n.timeout) {
    const newSocket = new this.options.n2n.SocketClass(options)
    const sid = newSocket.socketId
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
    if (!outview) {
      newSocket.once('error', error => {
        this._manageError(error, id, outview, undefined, 'inview error')
      })
    }
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
   * @private
   */
  _manageError (error, peerId, outview = false, reject, trace) {
    // chrome fix for disconnection
    if (error.message === 'Ice connection failed.') {
      this._debug('Chrome disconnection: ', peerId, error)
    } else {
      this._debug(`[%s] Error of the socket: (%s), this is just a log. The error is catched. [reject:${typeof reject}]`, this.id, peerId, error)
    }
    if (reject) {
      console.trace(error)
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
   * @private
   */
  _manageClose (peerId, outview = false, socketId) {
    if (outview && this.livingOutview.has(peerId)) {
      const p = this.livingOutview.get(peerId)
      // check if it is the same socketId
      if (p.socket.socketId === socketId) {
        this._debug('[%s] close outview: ', this.id, peerId, outview, p)
        this._deleteLiving(peerId, outview)
        if (p.occurences > 0) {
          this._signalCrash(peerId, p.occurences, outview)
          for (let i = 0; i < (p.occurences); ++i) {
            this._signalDisconnect(peerId, outview, true)
          }
        }
      } // else, nothing to do
    } else if (!outview && this.livingInview.has(peerId)) {
      const p = this.livingInview.get(peerId)
      if (p.socket.socketId === socketId) {
        this._deleteLiving(peerId, outview)
        if (p.occurences > 0) {
          this._signalCrash(peerId, p.occurences, outview)
          for (let i = 0; i < (p.occurences); ++i) {
            this._signalDisconnect(peerId, outview, true)
          }
        }
        this._debug('[%s] close inview: ', this.id, peerId, outview)
      }
    } else {
      console.warn('[socket does not exist] Connection closed', peerId)
    }
  }

  /**
   * Delete a living entry, either in the outview or in the inview
   * @param  {String} id      id the entry to delete
   * @param  {Boolean} outview If outview delete on the outview otherwise in the inview.
   * @return {void}
   * @private
   */
  _deleteLiving (id, outview) {
    if (outview) {
      this._debug('[%s] deleting outview living entry:', this.id, id)
      this.livingOutview.delete(id)
    } else {
      this._debug('[%s] deleting inview living entry:', this.id, id)
      this.livingInview.delete(id)
    }
  }

  /**
   * Delete a pending entry, either in the outview or in the inview
   * @param  {String} id      id the entry to delete
   * @param  {Boolean} outview If outview delete on the outview otherwise in the inview.
   * @return {void}
   * @private
   */
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
   * @private
   */
  _serialize (data) {
    return JSON.stringify(data)
  }
  /**
   * @description Deserialize data when received
   * @param  {string} data data received
   * @return {Object} Data parsed
   * @private
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
   * @private
   */
  _signalConnect (id, outview = false) {
    setTimeout(() => {
      if (outview) {
        this.emit(events.n2n.connection.out, id, true)
      } else {
        this.emit(events.n2n.connection.in, id, false)
      }
    }, 0)
  }
  /**
   * @description Signal when an arc is closed
   * @param  {string} id Id of the peer of the arc
   * @param  {Boolean} outview Is an inview or an outview arc
   * @param  {Boolean} if the arc is a failed arc or an arc that has been well disconnected
   * @return {void}
   * @private
   */
  _signalDisconnect (id, outview, fail = false) {
    setTimeout(() => {
      if (outview) {
        this.emit(events.n2n.disconnection.out, id, fail)
      } else {
        this.emit(events.n2n.disconnection.in, id, fail)
      }
    }, 0)
  }

  /**
   * Signal on the event 'crash' that a peer is not anymore connected, because he surely leaves the network.
   * It emits the identifier of the peer with the number of arcs disconnected and if it is an inview or outview arc
   * @param  {String}  id              identifier of the peer who leaves
   * @param  {Number}  occurences      Number of occurences in our view
   * @param  {Boolean} [outview=false] If the connection is an inview or outview peer
   * @return {void}
   * @private
   */
  _signalCrash (id, occurences, outview = false) {
    setTimeout(() => {
      if (outview) {
        this.emit(events.n2n.crash.out, id, occurences, outview)
      } else {
        this.emit(events.n2n.crash.in, id, occurences, outview)
      }
    }, 0)
  }

  /**
   * @description Callback called when we receive a message from a socket
   * @param  {String} id   id of the peer
   * @param  {Object} data data received
   * @return {void}
   * @private
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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * const c = new N2N({n2n: {id: 'c'}})
   * a.connect(b)
   * b.connect(c)
   * b.getNeighbours() => [{peer: {socket: ..., occurences: 1, lock: 0}}, id: 'c']
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
   * @example
   * // Offline connection
   * const N2N = require('n2n-wrtc').n2n
   * const a = new N2N({n2n: {id: 'a'}})
   * const b = new N2N({n2n: {id: 'b'}})
   * const c = new N2N({n2n: {id: 'c'}})
   * a.connect(b)
   * b.connect(c)
   * b.getNeighbours() => ['c']
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

  /**
   * Callback called upon message received.
   * @param  {String} id      Identifier of the peer.
   * @param  {*} message Message received.
   * @return {void}
   * @private
   */
  _receive (id, message) {
    switch (message.type) {
      case events.n2n.DISCONNECT:
        this._disconnectInview(id)
        break
      case events.n2n.DEC_IN:
        this._decreaseInview(id)
        break
      case events.n2n.INC_IN:
        this._increaseInview(id)
        break
      case events.n2n.CONNECT_TO_US:
        this.signaling.direct._connectToUs(message)
        break
      case events.n2n.RESPONSE:
        this.events.emit(message.jobId, message)
        break
      case events.n2n.DIRECT_TO:
        this.signaling.direct.receiveOffer(message)
        break
      case events.n2n.DIRECT_BACK:
        this.signaling.direct.receiveOffer(message)
        break
      case events.n2n.bridgeIO.BRIDGE:
        this.signaling.bridgeIO._bridge(id, message)
        break
      case events.n2n.bridgeIO.BRIDGE_FORWARD:
        this.signaling.bridgeIO.forward(message)
        break
      case events.n2n.bridgeIO.BRIDGE_FORWARD_BACK:
        this.signaling.bridgeIO.forwardBack(message)
        break
      case events.n2n.bridgeIO.BRIDGE_FORWARD_RESPONSE:
        this.signaling.bridgeIO.receiveOffer(message)
        break
      case events.n2n.bridgeOI.BRIDGE:
        this.signaling.bridgeOI._bridge(id, message)
        break
      case events.n2n.bridgeOI.BRIDGE_FORWARD:
        this.signaling.bridgeOI.forward(message)
        break
      case events.n2n.bridgeOI.BRIDGE_FORWARD_BACK:
        this.signaling.bridgeOI.forwardBack(message)
        break
      case events.n2n.bridgeOI.BRIDGE_FORWARD_RESPONSE:
        this.signaling.bridgeOI.receiveOffer(message)
        break
      case events.n2n.bridgeOO.BRIDGE:
        this.signaling.bridgeOO._bridge(id, message)
        break
      case events.n2n.bridgeOO.BRIDGE_FORWARD:
        this.signaling.bridgeOO.forward(message)
        break
      case events.n2n.bridgeOO.BRIDGE_FORWARD_BACK:
        this.signaling.bridgeOO.forwardBack(message)
        break
      case events.n2n.bridgeOO.BRIDGE_FORWARD_RESPONSE:
        this.signaling.bridgeOO.receiveOffer(message)
        break
      default:
        throw new Error('case not handled.')
    }
  }
}

module.exports = N2N
