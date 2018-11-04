class View extends Map {
  /**
   * Check if the Socket is available or not, by checking the number of occurences and the number of lock
   * Rule: occ - lock > 0 AND socket is connected
   * @param  {id} id identifier of the peer
   * @return {Boolean}    true or false if the peer is available or not
   * @private
   */
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
