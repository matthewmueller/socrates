/**
 * Module Dependencies
 */

var isError = require('lodash.iserror')
var isobj = require('isobj')
var keys = Object.keys

/**
 * Whitelisted keys
 */

var whitelist = {
  type: 1,
  meta: 1,
  error: 1,
  payload: 1
}

/**
 * Export `isFSA`
 */

module.exports = isFSA

/**
 * Check if the value is an action
 *
 * Spec: https://github.com/acdlite/flux-standard-action#actions
 *
 * @param {Mixed} value
 * @return {Boolean}
 */

function isFSA (value) {
  // value must be an object and have a type
  if (!isobj(value) || !value.type) return false

  // if any properties on the object are
  // not part of the whitelist fail then
  // return false
  var props = keys(value)
  for (var i = 0, prop; (prop = props[i]); i++) {
    if (!whitelist[prop]) return false
  }

  // lastly check that if value.error is "true"
  // that our payload is an Error object
  if (value.error === true && !isError(value.payload)) {
    return false
  }

  return true
}
