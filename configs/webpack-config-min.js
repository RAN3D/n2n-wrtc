const TerserPlugin = require('terser-webpack-plugin')
const lmerge = require('lodash.merge')
const webpackconfig = require('./webpack-config')

const config = lmerge(webpackconfig, {
  mode: 'production',
  output: {
    'filename': 'n2n-wrtc.bundle.min.js'
  },
  optimization: {
    minimizer: [new TerserPlugin({
      parallel: true,
      sourceMap: true
    })]
  }
})

config.module.rules.push({
  test: /\.js$/,
  use: ['source-map-loader'],
  enforce: 'pre'
})

console.log('Production configuration: ', config)
module.exports = config
