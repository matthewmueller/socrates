/**
 * Module dependencies
 */

var update = require('./update')
var tree = require('./tree')
var isobj = require('isobj')

/**
 * Export `reducer`
 */

module.exports = reducer

/**
 * Initialize `reducer`
 *
 * @param {Function|Object} fn
 * @return {Function}
 */

function reducer (fn) {
  fn = isobj(fn) ? tree(fn) : fn
  return function reduce (state, action) {
    var updates = fn(state, action)
    return update(state, updates)
  }
}
