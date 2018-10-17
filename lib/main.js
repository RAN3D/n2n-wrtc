const AbstractN2N = require('./api').n2n
const Neighborhood = require('./neighborhood')
const lmerge = require('lodash.merge')
const errors = require('./errors')
const short = require('short-uuid')
const translator = short()

class N2N extends AbstractN2N {
  constructor (options) {
    options = lmerge({
      n2n: {
        id: translator.new()
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
      }
    })
    this.view = options.view || new Neighborhood(this.viewOptions)
    this.view.on('receive', (...args) => {
      this.emit('receive', ...args)
    })
    this.view.on('connect', (id, outview) => {
      this.emit('connect', id, outview)
    })
    this.view.on('close', id => {
      this.emit('close', id)
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

  async connectFromUs (peerId) {
    return Promise.reject(errors.nyi())
  }

  async connectToUs (peerId) {
    return Promise.reject(errors.nyi())
  }

  async connectBridge (peerId) {
    return Promise.reject(errors.nyi())
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
}

module.exports = N2N
