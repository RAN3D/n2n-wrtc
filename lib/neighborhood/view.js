class View extends Map {
  isIn (id) {
    return super.has(id)
  }

  has (id) {
    if (super.has(id)) {
      const node = super.get(id)
      if (node.occurences === 0 && node.lock === 0) {
        return true
      } else if ((node.occurences - node.lock) > 0) {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }

  exist (id) {
    if (super.has(id)) {
      const node = super.get(id)
      if (node.occurences === 0) {
        return false
      } else {
        return true
      }
    } else {
      return false
    }
  }
}

module.exports = View
