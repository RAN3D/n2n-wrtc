const Neighborhood = require('./neighborhood')
const lmerge = require('lodash.merge')
const errors = require('./errors')
const short = require('short-uuid')
const events = require('./events')
const translator = short()
const EventEmitter = require('events')
const BridgeSignaling = require('./signaling').bridge
const DirectSignaling = require('./signaling').direct

class N2N extends EventEmitter {
  constructor (options) {
    super()
    this.options = lmerge({
      n2n: {
        protocol: 'n2n',
        id: translator.new(),
        timeout: 10000
      }
    }, options)
    this._debug = (require('debug'))('n2n:n2n')
    this.id = this.options.n2n.id
    this.viewOptions = lmerge(this.options, {
      neighborhood: {
        id: this.id
      },
      signaling: {
        id: this.id
      },
      socket: {
        objectMode: false
      }
    })
    this.events = new EventEmitter()
    this.view = options.view || new Neighborhood(this.viewOptions)
    this.view.on('receive', (id, message) => {
      this.emit(message.protocol, id, message.msg)
    })
    this.on(this.options.n2n.protocol, (id, message) => {
      this._debug('[%s/%s] receive a message from %s:', this.id, this.options.n2n.protocol, id, message)
      this._receive(id, message)
    })
    this.view.on('in', (id, outview) => {
      this.emit('in', id, outview)
    })
    this.view.on('out', (id, outview) => {
      this.emit('out', id, outview)
    })
    this.view.on('close_in', id => {
      this.emit('close', id, false)
      this.emit('close_in', id)
    })
    this.view.on('close_out', id => {
      this.emit('close', id, true)
      this.emit('close_out', id)
    })

    this.signaling = {
      bridge: new BridgeSignaling(this.options.signaling, this),
      direct: new DirectSignaling(this.options.signaling, this)
    }

    this.signaling.bridge.on(events.signaling.RECEIVE_OFFER, ({ initiator, destination, forward, offerType, offer }) => {
      if (!initiator || !destination || !offer || !offerType) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      // do we have the initiator in our list of connections?
      if (!this.view.livingInview.has(initiator) && offerType === 'new') {
        // we do have the socket for the moment, create it
        this.view.createNewSocket(this.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.view.livingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.bridge.sendOfferBack({
            initiator,
            destination,
            forward,
            offer: socketOffer,
            offerType: 'back'
          })
        })
        // WE RECEIVE THE OFFER ON THE ACCEPTOR
        this.view.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (offerType === 'new') {
          try {
            // WE RECEIVE THE OFFER ON THE ACCEPTOR
            this.view.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (offerType === 'back') {
          try {
            // WE RECEIVE THE ACCEPTED OFFER ON THE INITIATOR
            if (this.view.livingOutview.isIn(destination) && this.view.livingOutview.get(destination).socket.status !== 'connected') {
              this.view.livingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
            }
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        }
      }
    })

    this.signaling.direct.on(events.signaling.RECEIVE_OFFER, ({ jobId, initiator, destination, offerType, offer }) => {
      // console.log('[receive] receive an offer to emit to the socket... ', jobId, this.view.livingInview.has(initiator), this.view.livingOutview.exist(initiator), this.getNeighboursOutview().map(p => p.id), this.getNeighboursInview().map(p => p.id))
      if (!initiator || !destination || !offer || !offerType) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      // do we have the initiator in our list of connections?
      if (!this.view.livingInview.has(initiator) && offerType === 'new') {
        // we do have the socket for the moment, create it
        this.view.createNewSocket(this.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.view.livingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          const off = {
            jobId,
            initiator,
            destination,
            offer: socketOffer,
            offerType: 'back'
          }
          this.signaling.direct.sendOfferBack(off)
          // console.log('%s emitted accepted offers: ', jobId, off)
        })
        // WE RECEIVE THE OFFER ON THE ACCEPTOR
        // console.log('[first/new] receive an offer to emit to the socket... ', jobId)
        this.view.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
      } else {
        // now if it is a new offer, give it to initiator socket, otherwise to destination socket
        if (offerType === 'new') {
          try {
            // WE RECEIVE THE OFFER ON THE ACCEPTOR
            // console.log('[acceptor] receive an offer to accept to emit to the socket... ', jobId)
            this.view.livingInview.get(initiator).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        } else if (offerType === 'back') {
          try {
            // WE RECEIVE THE ACCEPTED OFFER ON THE INITIATOR
            // console.log('[initiator] receive an offer to accept to emit to the socket... ', jobId)
            if (this.view.livingOutview.isIn(destination) && this.view.livingOutview.get(destination).socket.status !== 'connected') {
              this.view.livingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
            }
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        }
      }
    })
  }

  /**
   * Connect to a peer using a signaling service. If the first parameter is a N2N instance
   * it connects directly us to the instance using an offline signaling service.
   * Otherwise it uses a signaling services provided by Neighborhood.
   * @param  {N2N}  n2n       N2N instance you want to connect with.
   * @param  {Signaling}  signaling You can provide your own signaling service (dont forget to add a listener to listen for incoming messages, (see our online/offline signaling to create your own.))
   * @return {Promise}  Resolved when the connection is successfully done, rejected otherwise.
   */
  async connect (n2n, signaling) {
    if (n2n) {
      return this.view.connect(n2n.view, signaling)
    } else {
      return this.view.connect(undefined, signaling)
    }
  }

  /**
   * Perform connections using existing connection or create new one using a bridge connection.
   * null means us
   * 'from' is null and 'to' is null: error
   * 'from' is null and 'to' is string: add an outview occurence (an arc)
   * 'to' is null and 'from' is string: add an outview from 'from'
   * 'from' is string and 'to' is string: bridge, add an arc (or create the connection) between 'from' and 'to' exchanging offers through us (not using a signaling server)
   * @param  {String|null}  [from=null] peer id
   * @param  {String|null}  [to=null]   peer id
   * @return {Promise} resolved if the promise of chosen case is resolved, otherwise reject with the appropriate method
   */
  async connect4u (from = null, to = null) {
    if (from === this.id) from = null
    if (to === this.id) to = null
    if (from && typeof from === 'string' && to && typeof to === 'string') {
      console.log('[%s] %s -bridge> %s !', this.id, from, to)
      return this.bridge(from, to)
    } else if (from && typeof from === 'string' && to === null) {
      // from to to us
      console.log('[%s] %s -> %s !', this.id, from, this.id)
      return this.connectToUs(from)
    } else if (to && typeof to === 'string' && from === null) {
      // connection from us to to
      if (this.view.livingOutview.has(to)) {
        console.log('[%s] %s -> %s !', this.id, this.id, to)
        return this.connectFromUs(to)
      } else {
        throw new Error(to + ' need to be in our outview.')
      }
    } else {
      throw errors.nyi()
    }
  }

  /**
   * Add outview connection to the peer specified by peerId (use an existing connection for that.)
   * @param  {String}  peerId peer id to connect with
   * @return {Promise} Resolve when successfully established. Rject otherwise
   */
  async connectFromUs (peerId) {
    return this.view.increaseOccurences(peerId, true)
    // this.send(this.options.n2n.protocol, peerId, {
    //   type: events.neighborhood.OCC_INC,
    //   id: this.id
    // })
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
    // console.log('connectToUs %s', peerId, this.view.livingOutview.isIn(peerId), this.view.livingInview.has(peerId))
    if (!this.view.livingOutview.isIn(peerId)) {
      throw errors.peerNotFound(peerId)
    } else {
      return new Promise((resolve, reject) => {
        // first lock the connection
        // this.view.lock(peerId)
        const tout = setTimeout(() => {
          // this.view.unlock(peerId)
          reject(new Error('timeout'))
        }, timeout)
        // first send a message to peerId
        const jobId = translator.new()
        this.events.once(jobId, (msg) => {
          if (msg.response) {
            // means yes, connection created
            // this.view.unlock(peerId)
            clearTimeout(tout)
            resolve()
          } else {
            clearTimeout(tout)
            // means no
            reject(new Error('connection cannot be established. Somthing wrong happened'))
          }
        })
        this.send(this.options.n2n.protocol, peerId, {
          type: events.n2n.CONNECT_TO_US,
          jobId,
          id: this.id
        }).catch(e => {
          // this.view.unlock(peerId)
          reject(e)
        })
      })
    }
  }
  async _connectToUs ({ type, id, jobId }) {
    const peerId = id
    // console.log('_connecteToUs: ', peerId, this.view.livingOutview.has(peerId), this.view.livingInview.has(peerId), jobId)
    if (!this.view.livingOutview.isIn(peerId) && this.view.livingInview.has(peerId)) {
      return new Promise((resolve, reject) => {
        // we need to create the connection by exchanging offer between the two peers
        const tout = setTimeout(() => {
          // console.log('error:_connecteToUs: ', peerId, this.view.livingOutview.has(peerId), this.view.livingInview.has(peerId), jobId)
          reject(new Error('timeout'))
        }, this.options.n2n.timeout)
        if (this.view.livingOutview.isIn(peerId)) throw new Error('please report!! cannot create a socket if the peer is already in our outview')
        const socket = this.view.createNewSocket(this.options.socket, peerId, true)
        socket.on('error', (error) => {
          this.view._manageError(error, peerId, true, reject)
        })
        socket.on(events.socket.EMIT_OFFER, (offer) => {
          const off = {
            jobId,
            initiator: this.id,
            destination: peerId,
            offer,
            offerType: 'new'
          }
          // console.log('%s offer sent:', jobId, off)
          this.signaling.direct.sendOfferTo(off)
        })
        socket.connect().then(() => {
          clearTimeout(tout)
          this.view.increaseOccurences(peerId).then(() => {
            resolve()
          }).catch(e => {
            reject(e)
          })
        }).catch(e => {
          clearTimeout(tout)
          reject(e)
        })
      })
    } else if (this.view.livingOutview.isIn(peerId)) {
      return this.connectFromUs(peerId)
    } else {
      throw new Error('Not allowed. Are you trying to beat me?')
    }
  }

  /**
   * Perform a bridge without locking any connection, this is your responsability to lock connections correctly.
   * @param  {String}  from peer id (initiator)
   * @param  {String}  dest   peer id (destination)
   * @return {Promise}
   */
  async bridge (from, dest, timeout = this.options.n2n.timeout) {
    return new Promise((resolve, reject) => {
      const jobId = translator.new()
      const tout = setTimeout(() => {
        reject(new Error('timeout'))
      }, timeout)
      this.events.once(jobId, (msg) => {
        clearTimeout(tout)
        if (msg.response) {
          resolve()
        } else {
          reject(new Error('bridge rejected.'))
        }
      })
      this.send(this.options.n2n.protocol, from, {
        type: events.n2n.BRIDGE,
        from,
        dest,
        forward: this.id,
        jobId
      }).catch(e => {
        reject(e)
      })
    })
  }
  _bridge (id, { from, dest, forward, jobId }) {
    if (this.view.livingOutview.exist(dest)) {
      try {
        this.view.increaseOccurences(dest, true).then(() => {
          this.send(this.options.n2n.protocol, forward, {
            type: events.n2n.RESPONSE,
            response: true,
            jobId
          }).catch(e => {
            console.error('cannot send response', e)
          })
        }).catch(e => {
          console.error('cannot increase occurences', e)
        })
      } catch (e) {
        console.error(e)
      }
    } else if (!this.view.livingOutview.isIn(dest)) {
      new Promise((resolve, reject) => {
        const tout = setTimeout(() => {
          reject(new Error('timeout'))
        }, this.options.n2n.timeout)
        const socket = this.view.createNewSocket(this.options.socket, dest, true)
        socket.on('error', (error) => {
          this.view._manageError(error, dest, true, reject)
        })
        socket.on(events.socket.EMIT_OFFER, (offer) => {
          const off = {
            initiator: this.id,
            destination: dest,
            forward,
            offer,
            offerType: 'new'
          }
          this.signaling.bridge.sendOfferTo(off)
        })
        socket.connect().then(() => {
          clearTimeout(tout)
          resolve()
        }).catch(e => {
          clearTimeout(tout)
          reject(e)
        })
      }).then(() => {
        this.view.increaseOccurences(dest, true).then(() => {
          this.send(this.options.n2n.protocol, forward, {
            type: events.n2n.RESPONSE,
            response: true,
            jobId
          }).catch(e => {
            console.error('cannot send response to ' + forward, e)
          })
        }).catch(e => {
          console.error('cannot increase occurences for ' + dest, e)
        })
      }).catch(e => {
        this.send(this.options.n2n.protocol, forward, {
          type: events.n2n.RESPONSE,
          response: false,
          jobId
        }).catch(e => {
          console.error('cannot send response to ' + forward, e)
        })
      })
    } else {
      this.send(this.options.n2n.protocol, forward, {
        type: events.n2n.RESPONSE,
        response: false,
        jobId
      }).catch(e => {
        console.error('cannot send response to ' + forward, e)
      })
    }
  }

  /**
   * @description Disconnect all or one arc.
   * @param  {String}  userId [description]
   * @return {Promise}        [description]
   */
  disconnect (peerId) {
    return this.view.disconnect(peerId)
  }

  /**
   * @description Get the list of all inviews sockets including occurences and the peer id connected with.
   * (Warning) occurences and lock are inconsistent because you have no control on your inview
   * @return {Array<Object>} Array of object [{peer: {socket, occurences, lock}, id}]
   */
  getNeighboursInview () {
    return this.view.getNeighboursInview()
  }

  /**
   * @description Get the list of all outviews sockets including occurences and lock and the peer id connected with.
   * Contrary to your inview, Occurences and lock are consistent because you have the control on your outview
   * @return {Array<Object>} Array of object [{peer: {socket, occurences, lock}, id}]
   */
  getNeighboursOutview () {
    return this.view.getNeighboursOutview()
  }

  /**
   * @description Get all reachable neighbours including socket, occurences, lock and ids
   * If the connection is totally locked you cant see it. Pass true as options if you want all neighbours even if connections are locked.
   * @param {Boolean} [all=false] if true, return all neighbours even if they are locked
   * @return {Array<Object>} Array of object [{peer: {socket, occurences, lock}, id}]
   */
  getNeighbours (all = false) {
    return this.view.getNeighbours(all)
  }

  /**
   * @description Return all ids of reachable peers (outview)
   * @param {Boolean} [all=false] if true, return all neighbours ids even if they are locked
   * @return {Array<String>}
   */
  getNeighboursIds (all = false) {
    return this.view.getNeighboursIds(all)
  }

  /**
   * @description Return a list of arcs inview/outview for the peer in an array of object {source: <string>, dest: <string>, outview: <boolean>}
   * @return {Array<Object>} [{source: <string>, dest: <string>, outview: <boolean>}, ...]
   */
  getArcs () {
    return this.view.getArcs()
  }

  /**
   * @description Send a message to the peer specified.
   * Firstly we try to send in the outview, then we try to send the message in the inview.
   * Then we throw an error if the peer is not found in the outview nor the inview.
   * @param  {String}  [protocol= 'receive'] Protocol (event) used to send the message, on receive the message will be emitted on this event
   * @param  {String}  peerId  peer id we want to send the message to
   * @param  {Object}  message Message to send
   * @return {Promise} Promise resolved when the message is sent, reject if the peer is not found or an error is return from the send method of the socket used.
   */
  async send (protocol = 'receive', id, msg) {
    return this.view.send(id, { protocol, msg })
  }
  _receive (id, message) {
    if (message && message.type && message.id && message.type === events.n2n.CONNECT_TO_US) {
      this._connectToUs(message).then(() => {
        this.send(this.options.n2n.protocol, id, {
          type: events.n2n.RESPONSE,
          jobId: message.jobId,
          response: true
        })
      }).catch(e => {
        this.send(this.options.n2n.protocol, id, {
          type: events.n2n.RESPONSE,
          jobId: message.jobId,
          response: false
        })
      })
    } else if (message && message.type && message.response && message.type === events.n2n.RESPONSE) {
      this.events.emit(message.jobId, message)
    } else if (message && message.type && message.type === events.n2n.DIRECT_TO) {
      this.signaling.direct.receiveOffer(message)
    } else if (message && message.type && message.type === events.n2n.DIRECT_BACK) {
      this.signaling.direct.receiveOffer(message)
    } else if (message && message.type && message.type === events.n2n.BRIDGE) {
      this._bridge(id, message)
    } else if (message && message.type && message.type === events.n2n.BRIDGE_FORWARD) {
      this.signaling.bridge.forward(message)
    } else if (message && message.type && message.type === events.n2n.BRIDGE_FORWARD_BACK) {
      this.signaling.bridge.forwardBack(message)
    } else if (message && message.type && message.type === events.n2n.BRIDGE_FORWARD_RESPONSE) {
      this.signaling.bridge.receiveOffer(message)
    }
  }
}

module.exports = N2N
