const AbstractN2N = require('./api').n2n
const Neighborhood = require('./neighborhood')
const lmerge = require('lodash.merge')
const errors = require('./errors')
const short = require('short-uuid')
const events = require('./events')
const translator = short()
const EventEmitter = require('events')
const BridgeSignaling = require('./signaling').bridge
const DirectSignaling = require('./signaling').direct

class N2N extends AbstractN2N {
  constructor (options) {
    options = lmerge({
      n2n: {
        id: translator.new(),
        timeout: 10000
      }
    }, options)
    super(options)
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
      this._receive(id, message)
    })
    this.view.on('connect', (id, outview) => {
      this.emit('connect', id, outview)
    })
    this.view.on('close', id => {
      this.emit('close', id)
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
            this.view.livingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
          } catch (e) {
            console.error('PLEASE REPORT THIS ISSUE: ', e)
          }
        }
      }
    })

    this.signaling.direct.on(events.signaling.RECEIVE_OFFER, ({ initiator, destination, offerType, offer }) => {
      console.log({ initiator, destination, offerType, offer })
      if (!initiator || !destination || !offer || !offerType) throw new Error('PLEASE REPORT, Problem with the offline signaling service. provide at least initiator, destination, type a,d the offer as properties in the object received')
      // do we have the initiator in our list of connections?
      if (!this.view.livingInview.has(initiator) && offerType === 'new') {
        // we do have the socket for the moment, create it
        this.view.createNewSocket(this.options.socket, initiator, false)
        // ATTENTION: LISTENERS HAVE TO BE DECLARED ONCE!
        this.view.livingInview.get(initiator).socket.on(events.socket.EMIT_OFFER, (socketOffer) => {
          this.signaling.direct.sendOfferBack({
            initiator,
            destination,
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
            this.view.livingOutview.get(destination).socket.emit(events.socket.RECEIVE_OFFER, offer)
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
    if (from && typeof from === 'string' && to && typeof to === 'string') {
      console.log('connectBridge: ', from, to)
      // bridge: create a connection between from and to if from is in inview and to is in outview
      return this.connectBridge(from, to)
    } else if (from && typeof from === 'string' && to === null) {
      console.log('connectToUs: ', from, to)
      // from to to us
      return this.connectToUs(from)
    } else if (to && typeof to === 'string' && from === null) {
      console.log('connectFromUs: ', from, to)
      // connection from us to to
      if (this.view.livingOutview.has(to)) {
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
    await this.view.increaseOccurences(peerId, true)
    this.send(peerId, {
      type: events.neighborhood.OCC_INC,
      id: this.id
    })
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
    if (!this.view.livingOutview.has(peerId)) {
      throw errors.peerNotFound(peerId)
    } else {
      return new Promise((resolve, reject) => {
        // first lock the connection
        this.view.lock(peerId)
        const tout = setTimeout(() => {
          this.view.unlock(peerId)
          reject(new Error('timeout'))
        }, timeout)
        // first send a message to peerId
        const jobId = translator.new()
        this.events.once(jobId, (msg) => {
          if (msg.response) {
            // means yes, connection created
            this.view.unlock(peerId)
            clearTimeout(tout)
            resolve()
          } else {
            clearTimeout(tout)
            // means no
            reject(new Error('connection cannot be established. Somthing wrong happened'))
          }
        })
        this.send(peerId, {
          type: events.n2n.CONNECT_TO_US,
          jobId,
          id: this.id
        }).catch(e => {
          this.view.unlock(peerId)
          reject(e)
        })
      })
    }
  }

  async _connectToUs (peerId) {
    if (!this.view.livingOutview.has(peerId) && this.view.livingInview.has(peerId)) {
      return new Promise((resolve, reject) => {
        // we need to create the connection by exchanging offer between the two peers
        const tout = setTimeout(() => {
          throw new Error('timeout')
        }, this.options.n2n.timeout)
        const socket = this.view.createNewSocket(this.options.socket, peerId, true)
        socket.on('error', (error) => {
          this.view._manageError(error, peerId, true, reject)
        })
        socket.on(events.socket.EMIT_OFFER, (offer) => {
          const off = {
            initiator: this.id,
            destination: peerId,
            offer,
            offerType: 'new'
          }
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
    } else if (this.view.livingOutview.has(peerId) && this.view.livingInview.has(peerId)) {
      return this.connectFromUs(peerId)
    } else {
      throw new Error('Not allowed. Are you trying to beat me?')
    }
  }

  /**
   * Connect the from peer to the dest peer by sending offer through you
   * The Dest peer must be in your outview list. Otherwise it will reject.
   * @param  {String} from                               peer id that can be in inview/outview
   * @param  {String} dest                               peer id that MUST be in the outview
   * @param  {Number} [timeout=this.options.n2n.timeout] Tiemout in milliseconds. (ms)
   * @return {Promise} Resolved when the connection is succesffully resolved. Otherwise reject by a timeout or peerNotfound
   */
  connectBridge (from, dest, timeout = this.options.n2n.timeout) {
    return new Promise((resolve, reject) => {
      // first verify if we have dest in our outview
      if (!this.view.livingOutview.has(dest)) {
        reject(new Error(dest + ' must be in our outview.'))
      } else {
        // lock the connection
        this.view.lock(dest)
        const jobId = translator.new()
        const tout = setTimeout(() => {
          this.view.unlock(dest)
          reject(new Error('timeout'))
        }, timeout)
        this.events.once(jobId, (msg) => {
          if (msg.response) {
            this.view.unlock(dest)
            clearTimeout(tout)
            resolve()
          } else {
            this.view.unlock(dest)
            clearTimeout(tout)
            reject(new Error('bridge rejected.'))
          }
        })
        this.send(from, {
          type: events.n2n.BRIDGE,
          from,
          dest,
          forward: this.id,
          jobId
        }).catch(e => {
          this.view.unlock(dest)
          clearTimeout(tout)
          reject(e)
        })
      }
    })
  }

  /**
   * Initiate a connection where offers will be forwared by a neighbor
   * @param  {String}  id      id of the forwarding peer
   * @param  {String}  from    our id
   * @param  {String}  dest    the id of the futur connected peer
   * @param  {String}  forward id of the forwarding peer again
   * @param  {String}  jobId   jobId
   * @return {Promise} Resolved when the promise conenction is successfully done
   */
  async _bridge (id, { from, dest, forward, jobId }) {
    // console.log('forward: %s | from: %s | dest: %s ', forward, from, dest)
    // just receive a bridge request
    if (!this.view.livingOutview.has(forward)) {
      this.send(forward, {
        type: events.n2n.RESPONSE,
        response: false
      })
    } else {
      new Promise((resolve, reject) => {
        // just check if we already have the connection (-_-), in this case just increase occurences and resolve
        if (this.view.livingOutview.has(dest)) {
          this.send(dest, {
            type: events.neighborhood.OCC_INC,
            id: this.id
          }).then(() => {
            resolve()
          }).catch(e => {
            reject(e)
          })
        } else {
          // first lock the connection with forward
          this.view.lock(forward)
          const tout = setTimeout(() => {
            this.view.unlock(forward)
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
        }
      }).then(() => {
        console.log('resolve')
        this.view.increaseOccurences(dest, true).then(() => {
          console.log('increase true.')
          this.send(forward, {
            type: events.n2n.RESPONSE,
            response: true,
            jobId
          }).then(() => {
            this.view.unlock(forward)
          }).catch(e => {
            this.view.unlock(forward)
          })
        })
      }).catch(e => {
        console.log('increase false.', e)
        this.send(forward, {
          type: events.n2n.RESPONSE,
          response: false,
          jobId
        }).then(() => {
          this.view.unlock(forward)
        }).catch(e => {
          console.error(e)
          this.view.unlock(forward)
        })
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
   * @return {Array<Object>} Array of object [{peer: {socket, occurences, lock}, id}]
   */
  getNeighbours () {
    return this.view.getNeighbours()
  }

  /**
   * @description Return all ids of reachable peers (outview)
   * @return {Array<String>}
   */
  getNeighboursIds () {
    return this.view.getNeighboursIds()
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
   * @param  {String}  peerId  peer id we want to send the message to
   * @param  {Object}  message Message to send
   * @return {Promise} Promise resolved when the message is sent, reject if the peer is not found or an error is return from the send method of the socket used.
   */
  async send (id, msg) {
    return this.view.send(id, msg)
  }

  /**
   * Listener called when a message is received from Neighborhood's sockets
   * @param  {String} id      peer id we receive the message
   * @param  {Object} message data received
   * @return {void}
   */
  _receive (id, message) {
    if (message && message.type && message.id && message.type === events.n2n.CONNECT_TO_US) {
      this._connectToUs(message.id).then(() => {
        this.send(id, {
          type: events.n2n.RESPONSE,
          jobId: message.jobId,
          response: true
        })
      }).catch(e => {
        this.send(id, {
          type: events.n2n.RESPONSE,
          jobId: message.jobId,
          response: false
        })
      })
    } else if (message && message.type && message.response && message.type === events.n2n.RESPONSE) {
      this.events.emit(message.jobId, message)
    } else if (message && message.type && message.type === events.n2n.DIRECT_TO) {
      console.log('direct_to: ', id, message)
      this.signaling.direct.receiveOffer(message)
    } else if (message && message.type && message.type === events.n2n.DIRECT_BACK) {
      console.log('direct_back: ', id, message)
      this.signaling.direct.receiveOffer(message)
    } else if (message && message.type && message.type === events.n2n.BRIDGE) {
      this._bridge(id, message)
    } else if (message && message.type && message.type === events.n2n.BRIDGE_FORWARD) {
      this.signaling.bridge.forward(message)
    } else if (message && message.type && message.type === events.n2n.BRIDGE_FORWARD_BACK) {
      this.signaling.bridge.forwardBack(message)
    } else if (message && message.type && message.type === events.n2n.BRIDGE_FORWARD_RESPONSE) {
      this.signaling.bridge.receiveOffer(message)
    } else {
      this.emit('receive', id, message)
    }
  }
}

module.exports = N2N
