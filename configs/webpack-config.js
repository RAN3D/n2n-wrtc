const webpack = require('webpack')
module.exports = {
  mode: 'development',
  entry: './lib/index.js',
  output: {
    'path': require('path').resolve(process.cwd(), './bin'),
    'filename': 'n2n-wrtc.bundle.js',
    'library': 'n2n',
    'libraryTarget': 'umd',
    'umdNamedDefine': true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: (name) => {
          return true
        },
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ 'env' ]
          }
        }
      }
    ]
  },
  devtool: 'source-map'
}
