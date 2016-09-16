/**
 * Module Dependencies
 */

var set = require('setvalue').set

/**
 * Expose `handle`
 */

module.exports = handle

/**
 * handle
 */

function handle (map) {
  return function (state, action) {
    if (map[action.type]) {
      return map[action.type](state, action.payload, map)
    }

    var keys = action.type.split(':')
    var handler = keys.pop()
    var obj = {}

    if (handler === 'set') {
      set(obj, keys, action.payload)
      return obj
    }
  }
}
