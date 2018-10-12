const AbstractN2N = require('./api').n2n
const Neighborhood = require('./neighborhood')
const lmerge = require('lodash.merge')
// const errors = require('./errors')
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
    this.view.on('connect', id => {
      this.emit('connect', id)
    })
    this.view.on('close', id => {
      this.emit('close', id)
    })
    this.bufferDisconnect = new Map()
    this.buffer = new Map()
  }

  async connect (n2n) {
    if (n2n) {
      return this.view.connect(n2n.view)
    } else {
      return this.view.connect()
    }
  }

  disconnect (peerId) {
    return this.view.disconnect(peerId)
  }

  getNeighboursInview () {
    const i = []
    this.view.getNeighbours().forEach((v, id) => {
      if (v.inview > 0) i.push(id)
    })
    return i
  }

  getNeighboursOutview () {
    const o = []
    this.view.getNeighbours().forEach((v, id) => {
      if (v.outview > 0) o.push(id)
    })
    return o
  }

  getNeighbours () {
    return this.view.getNeighbours()
  }

  async send (id, msg) {
    return this.view.send(id, msg)
  }
}

module.exports = N2N
