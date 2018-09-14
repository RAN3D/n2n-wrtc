const NeighborhoodAPI = require('../api').neighborhood
const short = require('short-uuid')
const translator = short()
const lmerge = require('lodash.merge')
const OfflineSignaling = require('../signaling').offline

class Neighborhood extends NeighborhoodAPI {
  constructor (options) {
    const id = translator.new()
    options = lmerge({
      neighborhood: {
        id,
        SocketClass: require('../sockets').simplepeer
      },
      socket: {
        localId: id
      }
    }, options)
    super(options)
    this._debug('Options set: ', this.options)
    this.id = id
  }

  async connect (neighborhood) {
    if (neighborhood) {
      const localSignaling = new OfflineSignaling()
      const remoteSignaling = new OfflineSignaling()
      // now link offline signaling
      await localSignaling.connect(remoteSignaling)
      await remoteSignaling.connect(localSignaling)
      // initialize sockets
      const remoteOptions = lmerge({
        remoteId: this.id,
        localId: neighborhood.id,
        initiator: false
      }, this.options.socket)
      console.log(remoteOptions)
      const remoteSocket = neighborhood.createNewSocket(remoteOptions, remoteSignaling)

      const localOptions = lmerge({
        remoteId: remoteSocket.id,
        localId: neighborhood.id,
        initiator: false
      }, this.options.socket)
      console.log(localOptions)
      const localSocket = this.createNewSocket(localOptions, localSignaling)

      return localSocket.connect().then(() => {
        this.living.set(localSocket.remoteId, localSocket)
        neighborhood.living.set(remoteSocket.localId, remoteSocket)
        return Promise.resolve()
      })
    }
  }

  async send (peerId, message) {
    //
  }

  async disconnect (options) {
    //
  }

  createNewSocket (options, signaling) {
    return new this.options.neighborhood.SocketClass(options, signaling)
  }
}

module.exports = Neighborhood
