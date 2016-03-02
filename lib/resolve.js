'use strict'

/**
 * Module Dependencies
 */

var is_fsa = require('./is-fsa')
var freeze = require('./freeze')
var sliced = require('sliced')
var redux = require('redux')
var isArray = Array.isArray
var vo = require('vo')

/**
 * Export `middleware`
 */

module.exports = resolve

/**
 * Resolve promises, arrays, objects, etc.
 */

function resolve (store) {
  return function (next) {
    return function (action) {
      var actions = sliced(arguments).map(function(action) {
        return isArray(action)
          ? action.map(function (a) { return vo(a, next) })
          : vo(action, fsa_check, next)
      })

      return vo.stack.apply(actions)(freeze(store.getState()))
        .then(function() {
          return store.getState()
        })
    }
  }
}

/**
 * Ensure that what's returned
 * is a flux standard action
 *
 * @param {Mixed} mixed
 * @return {Object}
 */

function fsa_check (mixed) {
  if (is_fsa(mixed)) return mixed
  throw new Error('resolved action (' + stringify(mixed) + ') is not the correct format. Please refer to the spec: https://github.com/acdlite/flux-standard-action#actions')
}

/**
 * Serialize our value
 *
 * @param {Mixed} mixed
 * @return {String}
 */

function stringify (mixed) {
  try {
    return JSON.stringify(mixed)
  } catch (e) {
    return mixed
  }
}
