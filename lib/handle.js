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
  map = map || {}

  return function (state, action) {
    var keys = action.type.split(/[: ]/)
    var handler = keys.shift()
    var rest = keys.join('.')

    // normalized path
    var path = rest
      ? [handler].concat(rest).join(':')
      : handler

    if (map[path]) return map[path](state, action.payload, map)

    var obj = {}
    if (handler === 'set') {
      if (!keys.length) return action.payload
      set(obj, keys.join('.').split('.'), action.payload)
      return obj
    }
  }
}
