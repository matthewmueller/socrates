/**
 * Module dependencies
 */

var combine = require('@f/combine-reducers')
var handle = require('./handle')
var isobj = require('isobj')

/**
 * Export `Tree`
 */

module.exports = Tree

/**
 * Initialize `Tree`
 *
 * @param {Object} map
 * @param {Function}
 */

function Tree (tree) {
  var obj = walk(tree, [], {})
  return handle(obj)
}

/**
 * Walk the object tree
 *
 * @param {Object} tree
 * @param {Array} trail
 * @return {Function}
 */

function walk (tree, tail, out) {
  for (var key in tree) {
    if (!tree.hasOwnProperty(key)) continue
    else if (typeof tree[key] === 'function') {
      var path = tail.length ? key + ':' + tail.join('.') : key
      out[path] = tail.reduceRight(function (fn, k) {
        var o = {}
        o[k] = fn
        return combine(o)
      }, tree[key])
    } else if (isobj(tree[key])) {
      walk(tree[key], tail.concat(key), out)
    }
  }

  return out
}
