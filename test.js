'use strict';

/**
 * Module Dependencies
 */

var redux = require('redux')
var Debug = require('redux-debug')
var debug = require('debug')('socrates')
var freeze = require('./lib/freeze')
var fetch = require('isomorphic-fetch')
var assign = require('object-assign')
var isobj = require('isobj')
var sliced = require('sliced')
var vo = require('vo')

var store = redux.createStore(
  reducer,
  { url: 'http://google.com' },
  redux.applyMiddleware(variadic(), Debug(debug))
)

function reducer (state, action) {
  return assign({}, state, action.payload)
}

store.subscribe(function() {
  console.log('changed', store.getState())
})

store.dispatch(function (state) {
  return fetch(state.url).then(function(res) {
    return { type: 'set status', payload: { status: res.status }}
  })
}, wrap(5000, {
  type: 'change name',
  payload: {
    name: 'an'
  }
}, {
  type: 'change name',
  payload: {
    name: 'matt'
  }
}))
.then(function (v) {
  console.log('value', v)
})
.catch(e => console.error(e.stack || e))

function wrap (ms, obj) {
  return function (state, fn) {
    setTimeout(function() {
      fn(null, obj)
    }, ms)
  }
}

// function slow_boot () {
//   return function (store) {
//     return function (next) {
//       return function (action) {
//         console.log('slow boot', action)
//         if (action.type === 'boot') {
//           console.log('booting')
//           setTimeout(function() {
//             console.log('booted')
//             next(action)
//           }, 1000)
//         } else {
//           return next(action)
//         }
//       }
//     }
//   }
// }

function promise () {
  return function (store) {
    return function (next) {
      return function (action) {
        if (typeof action.then !== 'function') {
          return next(action)
        }

        return Promise.resolve(action).then(store.dispatch)
      }
    }
  }
}

function variadic () {
  return function (store) {
    return function (next) {
      return function (action) {
        // if (arguments.length === 1) return next(action)
        var actions = sliced(arguments).map(function(action) {
          return vo(action, next)
        })
        return vo.stack.apply(actions)(freeze(store.getState()))
          .then(() => store.getState())
      }
    }
  }
}

store.dispatch()
.then(function (v) { console.log('later', v) })
