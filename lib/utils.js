module.exports = {
  timeout: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  startServer: () => new Promise((resolve, reject) => {
    const ss = require('child_process').spawn('npm', ['run', 'signaling'])
    ss.stdout.on('data', (data) => {
      setTimeout(() => resolve(ss), 2000) // let the server be initialized ;)
      console.log(`[SS]  ${data}`)
    })
    ss.stderr.on('data', (data) => {
      console.log(`[SS]: ${data}`)
    })
    ss.on('close', (code) => {
      console.log(`[SS] Signaling server exited with code ${code}`)
    })
  }),
  stopServer: (ss) => {
    ss.kill()
  }
}
