class View extends Map {
  available (id) {
    if (super.has(id)) {
      const node = super.get(id)
      if ((node.occurences - node.lock) > 0 && node.socket.status === 'connected') {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }
}

module.exports = View
