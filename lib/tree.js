/**
 * Module dependencies
 */

var combine = require('@f/combine-reducers')
var action = require('@f/handle-actions')
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
  let obj = walk(tree, [], {})
  return action(obj)
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
    if (typeof tree[key] === 'function') {
      let path = tail.length ? key + ' ' + tail.join('.') : key
      out[path] = tail.reduceRight(function (fn, k) {
        let o = {}
        o[k] = fn
        return combine(o)
      }, tree[key])
    } else if (isobj(tree[key])) {
      walk(tree[key], tail.concat(key), out)
    }
  }

  return out
}
