const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const lmerge = require('lodash.merge')
const webpackconfig = require('./webpack-config')

const config = lmerge(webpackconfig, {
  mode: 'production',
  output: {
    'filename': 'n2n-wrtc.bundle.min.js'
  },
  optimization: {
    minimizer: [new UglifyJSPlugin({
      sourceMap: true,
      parallel: true,
      uglifyOptions: {
        warnings: false,
        parse: {},
        compress: {},
        mangle: true, // Note `mangle.properties` is `false` by default.
        output: null,
        toplevel: false,
        nameCache: null,
        ie8: false,
        keep_fnames: false
      }
    })]
  }
})
console.log('Production configuration: ', config)
module.exports = config
