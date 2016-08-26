'use strict'

/**
 * Module Dependencies
 */

var isPlainObject = require('isobj')
var assign = require('object-assign')
var freeze = require('./freeze')
var sliced = require('sliced')
var isArray = Array.isArray
var keys = Object.keys

/**
 * Export `update`
 */

module.exports = update

/**
 * Update the object or array
 *
 * @param {Mixed} original
 * @param {Mixed, ...} updates
 * @return {Mixed}
 */

function update (original, update) {
  update = sliced(arguments, 2).reduce(function (o, n) { return resolve(o, n, true) }, update)
  return freeze(resolve(original, update))
}

/**
 * Resolve the updates
 *
 * @param {Mixed} original
 * @param {Array} updates
 */

function resolve (original, updates, keepNull) {
  return isPlainObject(original) && isPlainObject(updates)
    ? object(original, updates, keepNull)
    : isArray(original) && isArray(updates)
      ? array(original, updates)
      : updates === undefined ? original : updates
}

/**
 * Update objects
 *
 * @param {Object} original
 * @param {Array} updates
 * @return {Array}
 */

function object (original, updates, keepNull) {
  return keys(updates).reduce(function (obj, key, i) {
    if (!keepNull && updates[key] === null) {
      delete obj[key]
    } else {
      obj[key] = resolve(original[key], updates[key])
    }

    return obj
  }, assign({}, original))
}

/**
 * Update arrays
 *
 * @param {Array} original
 * @param {Array} updates
 * @return {Array}
 */

function array (original, updates) {
  return [].concat(updates)
}
