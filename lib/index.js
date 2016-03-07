'use strict'

/**
 * Module Dependencies
 */

var assign = require('object-assign')
var reducer = require('./reducer')
var resolve = require('./resolve')
var sliced = require('sliced')
var redux = require('redux')
var isArray = Array.isArray

/**
 * Are we running in a production build?
 */
var production = process && process.env && process.env.NODE_ENV === 'production'
var freeze
if (production) {
  freeze = function (obj) {
    return obj
  }
}
else {
  freeze = require('./freeze')
}

/**
 * Redux methods
 */

var Middleware = redux.applyMiddleware
var Store = redux.createStore

/**
 * Export `Socrates`
 */

module.exports = Socrates

/**
 * Initialize `Socrates`
 *
 * @param {Array} middlewares
 * @param {Function} root reducer
 * @return {Function} socrates
 */

function Socrates (middlewares, reduce) {
  if (!isArray(middlewares)) reduce = middlewares, middlewares = []
  middlewares = [resolve].concat(middlewares)
  reduce = reduce || identity

  // create our redux client
  var redux = Store(reducer(reduce), {}, Middleware.apply(null, middlewares))

  // initialize a store
  function store (action) {
    var array_context = isArray(this)
    if (!arguments.length && !array_context) return freeze(redux.getState())
    var actions = array_context ? sliced(this) : sliced(arguments)
    actions = wrap_emitter_style(actions)
    return redux.dispatch.apply(redux, actions)
  }

  // subscribe to changes
  store.subscribe = function subscribe (fn) {
    return redux.subscribe(function listener () {
      return fn(freeze(redux.getState()))
    })
  }

  return store
}

/**
 * Maybe wrap the emitter style
 * into a flux standard action
 *
 * @param {Array} actions
 * @return {Array}
 */

function wrap_emitter_style (actions) {
  if (actions.length < 2) return actions
  if (typeof actions[0] !== 'string') return actions
  return [{
    type: actions[0],
    payload: assign.apply(null, actions.slice(1))
  }]
}

/**
 * Identity function that
 * just builds on an action's payload
 */

function identity (state, action) {
  return action.payload
}
