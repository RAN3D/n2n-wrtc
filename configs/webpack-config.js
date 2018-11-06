module.exports = {
  mode: 'development',
  entry: './lib/main.js',
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
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  devtool: 'source-map'
}
