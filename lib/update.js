'use strict';

/**
 * Module Dependencies
 */

var is_plain_object = require('isobj')
var assign = require('object-assign')
var freeze = require('./freeze')
var sliced = require('sliced')
var is_array = Array.isArray
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

function resolve (original, updates, keep_null) {
  return is_plain_object(original) && is_plain_object(updates)
    ? object(original, updates, keep_null)
    : is_array(original) && is_array(updates)
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

function object (original, updates, keep_null) {
  return keys(updates).reduce(function (obj, key, i) {
    if (!keep_null && updates[key] === null) {
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


// var fruits = ['apples', 'oranges', 'pears']
// var obj = {
//   name: 'matt',
//   age: 26,
//   settings: {
//     theme: 'red',
//     tz: 'America/Los Angeles'
//   },
//   fruits: fruits
// }

// var a = {
//   pesky: 'change'
// }

// var out = update(obj, {
//   name: 'matt',
//   settings: {
//     tz: 'America/Chicago'
//   }
// }, {
//   settings: [a],
// })

// a.pesky = 'lol...'
// fruits.push('apricots')
// console.log(out)

// var fruits = ['a', 'b', 'c']
// console.log(update(fruits, 'd'))
// fruits.push('d')
