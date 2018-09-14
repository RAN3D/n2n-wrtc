console.log('main.js')
module.export = class N2N {
  constructor () {
    this._debug = (require('debug'))('n2n')
    this._debug('Initialized.')
  }
}
