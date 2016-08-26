'use strict'

/**
 * Module Dependencies
 */

var isFSA = require('./is-fsa')

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
      return typeof action === 'function'
        ? next(FSACheck(action(store.getState())))
        : next(action)
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

function FSACheck (mixed) {
  if (isFSA(mixed)) return mixed
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
