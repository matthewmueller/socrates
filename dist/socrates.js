(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process){
'use strict';

/**
 * Export `freeze`
 */

module.exports = freeze

/**
 * Are we running in a production build?
 */

var production = process && process.env && process.env.NODE_ENV === 'production'

/**
 * Is Freezable?
 *
 * @param {Object} object
 * @return {Boolean}
 */

function isFreezable(object) {
  if (object === null) return false

  return Array.isArray(object) ||
    typeof object === 'object'
}

/**
 * Check if we need to freeze this value
 *
 * @param {Object} object
 * @return {Boolean}
 */

function needsFreezing(object) {
  return isFreezable(object) && !Object.isFrozen(object)
}

/**
 * Recurse
 *
 * @param {Object}
 * @return {Object}
 */

function recur(object) {
  Object.freeze(object)

  Object.keys(object).forEach(function (key) {
    const value = object[key]
    if (needsFreezing(value)) {
      recur(value)
    }
  })

  return object
}

/**
 * Deeply freeze a plain javascript object.
 *
 * If `process.env.NODE_ENV === 'production'`, this returns the original object
 * witout freezing.
 *
 * @function
 * @sig a -> a
 * @param  {object} object Object to freeze.
 * @return {object} Frozen object, unless in production, then the same object.
 */

function freeze(object) {
  if (production) return object

  if (needsFreezing(object)) {
    recur(object)
  }

  return object
}

}).call(this,require('_process'))
},{"_process":26}],2:[function(require,module,exports){
'use strict'

/**
 * Module Dependencies
 */

var assign = require('object-assign')
var reducer = require('./reducer')
var resolve = require('./resolve')
var freeze = require('./freeze')
var sliced = require('sliced')
var redux = require('redux')
var isArray = Array.isArray

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

},{"./freeze":1,"./reducer":4,"./resolve":5,"object-assign":30,"redux":36,"sliced":41}],3:[function(require,module,exports){
/**
 * Module Dependencies
 */

var is_error = require('lodash.iserror')
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
 * Export `is_fsa`
 */

module.exports = is_fsa

/**
 * Check if the value is an action
 *
 * Spec: https://github.com/acdlite/flux-standard-action#actions
 *
 * @param {Mixed} value
 * @return {Boolean}
 */

function is_fsa (value) {
  // value must be an object and have a type
  if (!isobj(value) || !value.type) return false

  // if any properties on the object are
  // not part of the whitelist fail then
  // return false
  var props = keys(value)
  for (var i = 0, prop; prop = props[i]; i++) {
    if (!whitelist[prop]) return false
  }

  // lastly check that if value.error is "true"
  // that our payload is an Error object
  if (value.error === true && !is_error(value.payload)) {
    return false
  }

  return true
}

},{"isobj":28,"lodash.iserror":29}],4:[function(require,module,exports){
/**
 * Module dependencies
 */

var update = require('./update')
var tree = require('./tree')
var isobj = require('isobj')

/**
 * Export `reducer`
 */

module.exports = reducer;

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

},{"./tree":6,"./update":7,"isobj":28}],5:[function(require,module,exports){
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

},{"./freeze":1,"./is-fsa":3,"redux":36,"sliced":41,"vo":42}],6:[function(require,module,exports){
/**
 * Module dependencies
 */

var combine_reducer = require('@f/combine-reducers')
var compose_reducer = require('@f/compose-reducers')
var handle_action = require('@f/handle-actions')
var xor = require('component-xor')
var keys = Object.keys

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
  return walk(tree)
}

/**
 * Walk the object tree
 *
 * @param {Object} tree
 * @param {Array} trail
 * @return {Function}
 */

function walk (tree, trail) {
  trail = trail || []

  var funcs = {}
  var map = {}
  var path

  // segment
  for (var k in tree) {
    if (typeof tree[k] === 'function') {
      path = trail.length ? k + ' ' + trail.join('.') : k
      funcs[path] = tree[k]
    } else {
      map[k] = walk(tree[k], trail.concat(k))
    }
  }

  var fl = keys(funcs).length
  var ml = keys(map).length

  // if we have only of one type
  // or another, return reducers
  if (xor(fl, ml)) {
    return fl
      ? handle_action(funcs)
      : combine_reducer(map)
  }

  // otherwise compose the two
  // different segments into a
  // single reducer
  return compose_reducer(
    handle_action(funcs),
    combine_reducer(map)
  )
}

// var state = {
//   user: {
//     name: 'matt',
//     age: 26
//   },
//   book: {
//     name: 'alchemist',
//     pages: [
//       {
//         number: 1,
//         text: 'this is a good story'
//       },
//       {
//         number: 2,
//         text: 'about a boy'
//       }
//     ]
//   }
// }

// var tree = Tree({
//   user: {
//     update: function (state, action) {
//       console.log('update', state, action)
//     }
//   },
//   book: {
//     rename: function (state, action) {
//       console.log('rename', state, action)
//     },
//     pages: {
//       add: function (state, action) {
//         console.log('add', state, action)
//       },
//       edit: function (state, action) {
//         console.log('edit', state, action)
//       }
//     }
//   }
// })

// tree(state, {
//   type: 'rename book',
//   payload: {
//     name: 'new name'
//   }
// })

// tree(state, {
//   type: 'add book.pages',
//   payload: [
//     {
//       number: '3',
//       text: 'another great page'
//     }
//   ]
// })

// var s = tree(state, {
//   type: 'edit book.pages',
//   payload: {
//     number: 5,
//     text: 'another great page'
//   }
// })

},{"@f/combine-reducers":8,"@f/compose-reducers":20,"@f/handle-actions":22,"component-xor":27}],7:[function(require,module,exports){
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

},{"./freeze":1,"isobj":28,"object-assign":30,"sliced":41}],8:[function(require,module,exports){
/**
 * Modules
 */

var clone = require('@f/clone-shallow')
var composeReducers = require('@f/compose-reducers')

/**
 * Expose combineReducers
 */

module.exports = combineReducers['default'] = combineReducers

/**
 * combineReducers
 */

function combineReducers (reducers, defaultState) {
  defaultState = defaultState || {}

  return composeReducers.apply(null, Object
    .keys(reducers)
    .map(function (key) {
      return scopeReducer(reducers[key], key, defaultState)
    }))
}

function scopeReducer (reducer, prop, defaultState) {
  return function (state, action) {
    if (state === undefined) state = defaultState

    var childState = reducer(state[prop], action)

    if (childState !== state[prop]) {
      state = clone(state)
      state[prop] = childState
    }

    return state
  }
}

},{"@f/clone-shallow":9,"@f/compose-reducers":18}],9:[function(require,module,exports){
/**
 * Modules
 */

var cloneObj = require('@f/clone-obj')
var cloneArray = require('@f/slice')
var isArray = require('@f/is-array')

/**
 * Expose cloneShallow
 */

module.exports = cloneShallow

/**
 * Clone object or array shallow
 * @param  {Object|Array} a object to copy
 * @return {Object|Array}
 */

function cloneShallow (a) {
  return isArray()
    ? cloneArray(a)
    : cloneObj(a)
}

},{"@f/clone-obj":10,"@f/is-array":16,"@f/slice":17}],10:[function(require,module,exports){
/**
 * Modules
 */

var forEach = require('@f/foreach')

/**
 * Expose cloneObj
 */

module.exports = cloneObj['default'] = cloneObj

/**
 * Clone an object.
 * @param  {Object} obj Object to Clone
 * @return {Object}
 */

function cloneObj (obj) {
  var newObj = {}

  forEach(function (val, key) {
    newObj[key] = val
  }, obj)

  return newObj
}

},{"@f/foreach":11}],11:[function(require,module,exports){
/**
 * Modules
 */

var isObject = require('@f/is-object')
var isArray = require('@f/is-array')
var forEachObj = require('@f/foreach-obj')
var forEachArr = require('@f/foreach-array')

/**
 * Expose foreach
 */

module.exports = forEach['default'] = forEach

/**
 * For each
 * @param  {Function} fn  iterator
 * @param  {Object}   obj object to iterate over
 */

function forEach (fn, a) {
  if (isArray(a)) return forEachArr.call(this, fn, a)
  if (isObject(a)) return forEachObj.call(this, fn, a)
}

},{"@f/foreach-array":12,"@f/foreach-obj":13,"@f/is-array":16,"@f/is-object":14}],12:[function(require,module,exports){
/**
 * Expose forEach
 */

module.exports = forEach['default'] = forEach

/**
 * forEach
 */

function forEach (fn, arr) {
  if (!arr) return

  for (var i = 0, len = arr.length; i < len; ++i) {
    fn.call(this, arr[i], i)
  }
}

},{}],13:[function(require,module,exports){
/**
 * Expose forEach
 */

module.exports = forEach['default'] = forEach

/**
 * forEach
 */

function forEach (fn, obj) {
  if (!obj) return

  var keys = Object.keys(obj)

  for (var i = 0, len = keys.length; i < len; ++i) {
    var key = keys[i]
    fn.call(this, obj[key], key)
  }
}

},{}],14:[function(require,module,exports){
/**
 * Modules
 */

var isFunction = require('@f/is-function')

/**
 * Expose isObject
 */

module.exports = isObject

/**
 * Constants
 */

var objString = toString(Object)

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject (val) {
  return !!val && (val.constructor === Object || isObjectString(val.constructor))
}

function isObjectString (val) {
  return !!val && isFunction(val) && toString(val) === objString
}

function toString (val) {
  return Function.prototype.toString.call(val)
}

},{"@f/is-function":15}],15:[function(require,module,exports){
/**
 * Modules
 */

/**
 * Expose isFunction
 */

module.exports = isFunction['default'] = isFunction

/**
 * isFunction
 */

function isFunction (value) {
  return typeof value === 'function'
}

},{}],16:[function(require,module,exports){
/**
 * Expose isArray
 */

module.exports = isArray['default'] = isArray

/**
 * isArray
 */

function isArray (val) {
  return Array.isArray(val)
}

},{}],17:[function(require,module,exports){
/**
 * Expose slice
 */

module.exports = slice

/**
 * slice
 */

function slice (array, begin, end) {
  begin = begin || 0
  end = end || array.length

  var arr = new Array(array.length)
  for (var i = begin; i < end; ++i) {
    arr[i - begin] = array[i]
  }
  return arr
}

},{}],18:[function(require,module,exports){
/**
 * Modules
 */

var toArray = require('@f/to-array')

/**
 * Expose composeReducers
 */

module.exports = composeReducers['default'] = composeReducers

/**
 * composeReducers
 */

function composeReducers (/* arguments */) {
  var args = toArray(arguments)
  var len = args.length

  return function (state, action) {
    for (var i = 0; i < len; ++i) {
      state = args[i](state, action)
    }

    return state
  }
}

},{"@f/to-array":19}],19:[function(require,module,exports){
/**
 * Expose toArray
 */

module.exports = toArray['default'] = toArray

/**
 * Convert to an array from array like
 * @param  {ArrayLike} arr
 * @return {Array}
 */

function toArray (arr) {
  var len = arr.length
  var idx = -1

  var array = new Array(len)
  while (++idx < len) {
    array[idx] = arr[idx]
  }
  return array
}

},{}],20:[function(require,module,exports){
arguments[4][18][0].apply(exports,arguments)
},{"@f/to-array":21,"dup":18}],21:[function(require,module,exports){
arguments[4][19][0].apply(exports,arguments)
},{"dup":19}],22:[function(require,module,exports){
/**
 * Modules
 */

var composeReducers = require('@f/compose-reducers')
var isUndefined = require('@f/is-undefined')

/**
 * Expose handleActions
 */

module.exports = handleActions['default'] = handleActions

/**
 * handleActions
 */

function handleActions (map, defaultState) {
  return composeReducers.apply(null, Object
    .keys(map)
    .map(function (type) {
      return scopeReducer(type, map[type], defaultState)
    }))
}

function scopeReducer (type, reducer, defaultState) {
  return function (state, action) {
    return action.type === type
      ? reducer(state, action.payload)
      : (isUndefined(state) ? defaultState : state)
  }
}

},{"@f/compose-reducers":23,"@f/is-undefined":25}],23:[function(require,module,exports){
arguments[4][18][0].apply(exports,arguments)
},{"@f/to-array":24,"dup":18}],24:[function(require,module,exports){
arguments[4][19][0].apply(exports,arguments)
},{"dup":19}],25:[function(require,module,exports){
/**
 * Expose isUndefined
 */

module.exports = isUndefined['default'] = isUndefined

/**
 * Check if undefined.
 * @param  {Mixed}  value
 * @return {Boolean}
 */

function isUndefined (value) {
  return typeof value === 'undefined'
}

},{}],26:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],27:[function(require,module,exports){
/**
 * Expose `xor`
 */

module.exports = xor;

/**
 * XOR utility
 *
 * T T F
 * T F T
 * F T T
 * F F F
 *
 * @param {Boolean} a
 * @param {Boolean} b
 * @return {Boolean}
 */

function xor(a, b) {
  return a ^ b;
}

},{}],28:[function(require,module,exports){
'use strict';

module.exports = function (obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
};

},{}],29:[function(require,module,exports){
/**
 * lodash 3.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var errorTag = '[object Error]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is an `Error`, `EvalError`, `RangeError`, `ReferenceError`,
 * `SyntaxError`, `TypeError`, or `URIError` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an error object, else `false`.
 * @example
 *
 * _.isError(new Error);
 * // => true
 *
 * _.isError(Error);
 * // => false
 */
function isError(value) {
  if (!isObjectLike(value)) {
    return false;
  }
  return (objectToString.call(value) == errorTag) ||
    (typeof value.message == 'string' && typeof value.name == 'string');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isError;

},{}],30:[function(require,module,exports){
/* eslint-disable no-unused-vars */
'use strict';
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

module.exports = Object.assign || function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (Object.getOwnPropertySymbols) {
			symbols = Object.getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],31:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.__esModule = true;
exports["default"] = applyMiddleware;

var _compose = require('./compose');

var _compose2 = _interopRequireDefault(_compose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
function applyMiddleware() {
  for (var _len = arguments.length, middlewares = Array(_len), _key = 0; _key < _len; _key++) {
    middlewares[_key] = arguments[_key];
  }

  return function (createStore) {
    return function (reducer, initialState, enhancer) {
      var store = createStore(reducer, initialState, enhancer);
      var _dispatch = store.dispatch;
      var chain = [];

      var middlewareAPI = {
        getState: store.getState,
        dispatch: function dispatch(action) {
          return _dispatch(action);
        }
      };
      chain = middlewares.map(function (middleware) {
        return middleware(middlewareAPI);
      });
      _dispatch = _compose2["default"].apply(undefined, chain)(store.dispatch);

      return _extends({}, store, {
        dispatch: _dispatch
      });
    };
  };
}
},{"./compose":34}],32:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports["default"] = bindActionCreators;
function bindActionCreator(actionCreator, dispatch) {
  return function () {
    return dispatch(actionCreator.apply(undefined, arguments));
  };
}

/**
 * Turns an object whose values are action creators, into an object with the
 * same keys, but with every function wrapped into a `dispatch` call so they
 * may be invoked directly. This is just a convenience method, as you can call
 * `store.dispatch(MyActionCreators.doSomething())` yourself just fine.
 *
 * For convenience, you can also pass a single function as the first argument,
 * and get a function in return.
 *
 * @param {Function|Object} actionCreators An object whose values are action
 * creator functions. One handy way to obtain it is to use ES6 `import * as`
 * syntax. You may also pass a single function.
 *
 * @param {Function} dispatch The `dispatch` function available on your Redux
 * store.
 *
 * @returns {Function|Object} The object mimicking the original object, but with
 * every action creator wrapped into the `dispatch` call. If you passed a
 * function as `actionCreators`, the return value will also be a single
 * function.
 */
function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === 'function') {
    return bindActionCreator(actionCreators, dispatch);
  }

  if (typeof actionCreators !== 'object' || actionCreators === null) {
    throw new Error('bindActionCreators expected an object or a function, instead received ' + (actionCreators === null ? 'null' : typeof actionCreators) + '. ' + 'Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?');
  }

  var keys = Object.keys(actionCreators);
  var boundActionCreators = {};
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var actionCreator = actionCreators[key];
    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }
  return boundActionCreators;
}
},{}],33:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;
exports["default"] = combineReducers;

var _createStore = require('./createStore');

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _warning = require('./utils/warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function getUndefinedStateErrorMessage(key, action) {
  var actionType = action && action.type;
  var actionName = actionType && '"' + actionType.toString() + '"' || 'an action';

  return 'Reducer "' + key + '" returned undefined handling ' + actionName + '. ' + 'To ignore an action, you must explicitly return the previous state.';
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action) {
  var reducerKeys = Object.keys(reducers);
  var argumentName = action && action.type === _createStore.ActionTypes.INIT ? 'initialState argument passed to createStore' : 'previous state received by the reducer';

  if (reducerKeys.length === 0) {
    return 'Store does not have a valid reducer. Make sure the argument passed ' + 'to combineReducers is an object whose values are reducers.';
  }

  if (!(0, _isPlainObject2["default"])(inputState)) {
    return 'The ' + argumentName + ' has unexpected type of "' + {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] + '". Expected argument to be an object with the following ' + ('keys: "' + reducerKeys.join('", "') + '"');
  }

  var unexpectedKeys = Object.keys(inputState).filter(function (key) {
    return !reducers.hasOwnProperty(key);
  });

  if (unexpectedKeys.length > 0) {
    return 'Unexpected ' + (unexpectedKeys.length > 1 ? 'keys' : 'key') + ' ' + ('"' + unexpectedKeys.join('", "') + '" found in ' + argumentName + '. ') + 'Expected to find one of the known reducer keys instead: ' + ('"' + reducerKeys.join('", "') + '". Unexpected keys will be ignored.');
  }
}

function assertReducerSanity(reducers) {
  Object.keys(reducers).forEach(function (key) {
    var reducer = reducers[key];
    var initialState = reducer(undefined, { type: _createStore.ActionTypes.INIT });

    if (typeof initialState === 'undefined') {
      throw new Error('Reducer "' + key + '" returned undefined during initialization. ' + 'If the state passed to the reducer is undefined, you must ' + 'explicitly return the initial state. The initial state may ' + 'not be undefined.');
    }

    var type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.');
    if (typeof reducer(undefined, { type: type }) === 'undefined') {
      throw new Error('Reducer "' + key + '" returned undefined when probed with a random type. ' + ('Don\'t try to handle ' + _createStore.ActionTypes.INIT + ' or other actions in "redux/*" ') + 'namespace. They are considered private. Instead, you must return the ' + 'current state for any unknown actions, unless it is undefined, ' + 'in which case you must return the initial state, regardless of the ' + 'action type. The initial state may not be undefined.');
    }
  });
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers);
  var finalReducers = {};
  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i];
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }
  var finalReducerKeys = Object.keys(finalReducers);

  var sanityError;
  try {
    assertReducerSanity(finalReducers);
  } catch (e) {
    sanityError = e;
  }

  return function combination() {
    var state = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    var action = arguments[1];

    if (sanityError) {
      throw sanityError;
    }

    if (process.env.NODE_ENV !== 'production') {
      var warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action);
      if (warningMessage) {
        (0, _warning2["default"])(warningMessage);
      }
    }

    var hasChanged = false;
    var nextState = {};
    for (var i = 0; i < finalReducerKeys.length; i++) {
      var key = finalReducerKeys[i];
      var reducer = finalReducers[key];
      var previousStateForKey = state[key];
      var nextStateForKey = reducer(previousStateForKey, action);
      if (typeof nextStateForKey === 'undefined') {
        var errorMessage = getUndefinedStateErrorMessage(key, action);
        throw new Error(errorMessage);
      }
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}
}).call(this,require('_process'))
},{"./createStore":35,"./utils/warning":37,"_process":26,"lodash/isPlainObject":40}],34:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports["default"] = compose;
/**
 * Composes single-argument functions from right to left.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing functions from right to
 * left. For example, compose(f, g, h) is identical to arg => f(g(h(arg))).
 */
function compose() {
  for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  return function () {
    if (funcs.length === 0) {
      return arguments.length <= 0 ? undefined : arguments[0];
    }

    var last = funcs[funcs.length - 1];
    var rest = funcs.slice(0, -1);

    return rest.reduceRight(function (composed, f) {
      return f(composed);
    }, last.apply(undefined, arguments));
  };
}
},{}],35:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.ActionTypes = undefined;
exports["default"] = createStore;

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var ActionTypes = exports.ActionTypes = {
  INIT: '@@redux/INIT'
};

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [initialState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} enhancer The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
function createStore(reducer, initialState, enhancer) {
  if (typeof initialState === 'function' && typeof enhancer === 'undefined') {
    enhancer = initialState;
    initialState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.');
    }

    return enhancer(createStore)(reducer, initialState);
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.');
  }

  var currentReducer = reducer;
  var currentState = initialState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return currentState;
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all states changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.');
    }

    var isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {
    if (!(0, _isPlainObject2["default"])(action)) {
      throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
    }

    if (typeof action.type === 'undefined') {
      throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant?');
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = currentListeners = nextListeners;
    for (var i = 0; i < listeners.length; i++) {
      listeners[i]();
    }

    return action;
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.');
    }

    currentReducer = nextReducer;
    dispatch({ type: ActionTypes.INIT });
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT });

  return {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  };
}
},{"lodash/isPlainObject":40}],36:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;
exports.compose = exports.applyMiddleware = exports.bindActionCreators = exports.combineReducers = exports.createStore = undefined;

var _createStore = require('./createStore');

var _createStore2 = _interopRequireDefault(_createStore);

var _combineReducers = require('./combineReducers');

var _combineReducers2 = _interopRequireDefault(_combineReducers);

var _bindActionCreators = require('./bindActionCreators');

var _bindActionCreators2 = _interopRequireDefault(_bindActionCreators);

var _applyMiddleware = require('./applyMiddleware');

var _applyMiddleware2 = _interopRequireDefault(_applyMiddleware);

var _compose = require('./compose');

var _compose2 = _interopRequireDefault(_compose);

var _warning = require('./utils/warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

/*
* This is a dummy function to check if the function name has been altered by minification.
* If the function has been minified and NODE_ENV !== 'production', warn the user.
*/
function isCrushed() {}

if (process.env.NODE_ENV !== 'production' && typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
  (0, _warning2["default"])('You are currently using minified code outside of NODE_ENV === \'production\'. ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or DefinePlugin for webpack (http://stackoverflow.com/questions/30030031) ' + 'to ensure you have the correct code for your production build.');
}

exports.createStore = _createStore2["default"];
exports.combineReducers = _combineReducers2["default"];
exports.bindActionCreators = _bindActionCreators2["default"];
exports.applyMiddleware = _applyMiddleware2["default"];
exports.compose = _compose2["default"];
}).call(this,require('_process'))
},{"./applyMiddleware":31,"./bindActionCreators":32,"./combineReducers":33,"./compose":34,"./createStore":35,"./utils/warning":37,"_process":26}],37:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports["default"] = warning;
/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
  /* eslint-enable no-console */
  try {
    // This error was thrown as a convenience so that you can use this stack
    // to find the callsite that caused this warning to fire.
    throw new Error(message);
    /* eslint-disable no-empty */
  } catch (e) {}
  /* eslint-enable no-empty */
}
},{}],38:[function(require,module,exports){
/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

module.exports = isHostObject;

},{}],39:[function(require,module,exports){
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],40:[function(require,module,exports){
var isHostObject = require('./_isHostObject'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var getPrototypeOf = Object.getPrototypeOf;

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) ||
      objectToString.call(value) != objectTag || isHostObject(value)) {
    return false;
  }
  var proto = getPrototypeOf(value);
  if (proto === null) {
    return true;
  }
  var Ctor = proto.constructor;
  return (typeof Ctor == 'function' &&
    Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString);
}

module.exports = isPlainObject;

},{"./_isHostObject":38,"./isObjectLike":39}],41:[function(require,module,exports){

/**
 * An Array.prototype.slice.call(arguments) alternative
 *
 * @param {Object} args something with a length
 * @param {Number} slice
 * @param {Number} sliceEnd
 * @api public
 */

module.exports = function (args, slice, sliceEnd) {
  var ret = [];
  var len = args.length;

  if (0 === len) return ret;

  var start = slice < 0
    ? Math.max(0, slice + len)
    : slice || 0;

  if (sliceEnd !== undefined) {
    len = sliceEnd < 0
      ? sliceEnd + len
      : sliceEnd
  }

  while (len-- > start) {
    ret[len - start] = args[len];
  }

  return ret;
}


},{}],42:[function(require,module,exports){
(function (global){
'use strict'

/**
 * Module Dependencies
 */

var Promise = global.Promise || require('es6-promise').Promise
var Pipeline = require('./lib/pipeline')
var Stack = require('./lib/stack')
var sliced = require('sliced')
var isArray = Array.isArray
var noop = function () {}
var keys = Object.keys

/**
 * Module Exports
 */

module.exports = Vo

/**
 * Initialize a `Vo` instance
 *
 * @param {Array|Object|Function, ...}
 * @return {Function}
 */

function Vo() {
  var pipeline = isArray(this) ? sliced(this) : sliced(arguments)

  // run vo
  return run(function (context, args, done) {
    Pipeline(pipeline, context, args, function(err, args) {
      if (err) return done.call(context, err)
      return done.apply(context, [null].concat(args))
    })
  })
}

/**
 * Pipeline the functions
 *
 * @param {Mixed}
 * @return {Function}
 */

Vo.stack = function stack () {
  var stack = isArray(this) ? sliced(this) : sliced(arguments)

  // run the stack
  return run(function (context, args, done) {
    Stack(stack, context, args, function(err, v) {
      if (err) return done(err)
      return done.apply(this, [null].concat(v))
    })
  })
}

/**
 * Simple wrapper that will allow us
 * to switch between fixed arguments
 * and transform pipelines
 *
 * @param {Function} fn
 * @return {Function}
 */

function run (fn) {
  function vo () {
    var args = sliced(arguments)
    var last = args[args.length - 1]
    var context = this

    if (typeof last === 'function') {
      var done = args.pop()
      fn(context, args, done)
    } else {
      // return a promise
      return new Promise(function (success, failure) {
        fn(context, args, function(err, ret) {
          if (arguments.length > 2) ret = sliced(arguments, 1)
          return err ? failure(err) : success(ret)
        })
      })
    }
  }

  // with "vo instanceof Vo"
  vo.vo = true

  return vo
}

/**
 * Catch errors
 *
 * @param {Function} fn
 * @return {Function}
 */

Vo.catch = function (fn) {
  // simple wrapper to avoid attaching to the passed-in function
  function catcher () { return fn }
  catcher.catch = true
  return catcher
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lib/pipeline":44,"./lib/stack":45,"es6-promise":49,"sliced":41}],43:[function(require,module,exports){
/**
 * Module Dependencies
 */

var compact = require('lodash.compact')
var error = require('err-candy')
var wrapped = require('wrapped')
var type = require('./type')
var keys = Object.keys

/**
 * Export `compile`
 */

module.exports = compile

/**
 * Compile
 */

function compile (mixed) {
  switch (type(mixed)) {
    case 'function': return Func(mixed)
    case 'object': return object(mixed)
    case 'catch': return Catcher(mixed)
    case 'array': return array(mixed)
    case 'vo': return Vo(mixed)
    default: return Identity(mixed)
  }
}

/**
 * Wrap functions
 *
 * @param {Function} fn
 * @return {Function}
 */

function Func (fn) {
  return function func (args, done) {
    wrapped(fn).apply(this, args.concat(next))

    function next(err) {
      if (err) return done(error(err))
      return done.apply(null, arguments)
    }
  }
}

/**
 * Wrap Objects
 *
 * @param {Object|Array} iterable
 * @return {Function}
 */

function object (o) {
  // compile the object
  o = keys(o).reduce(function (o, k) {
    o[k] = compile(o[k])
    return o
  }, o)

  return function obj (args, done) {
    var pending = keys(o).length
    var context = this
    var errors = []
    var out = {}

    // if we don't have any pending
    // values, return immediately
    if (!pending) return done(null, out)

    keys(o).map(function(k, i) {
      o[k].call(context, args, function(err, args) {
        if (err) {
          errors[i] = err
          out[k] = err
        } else {
          out[k] = args
        }

        if (!--pending) {
          errors = compact(errors)
          return errors.length
            ? done(error(errors), out)
            : done(null, out)
        }
      })
    })
  }
}

/**
 * Wrap Arrays
 */

function array (a) {
  a = a.map(compile)

  return function arr (args, done) {
    var pending = a.length
    var context = this
    var errors = []
    var out = []

    // if we don't have any pending
    // values, return immediately
    if (!pending) return done(null, out)

    // run in parallel
    a.map(function (fn, i) {
      fn.call(context, args, function(err, args) {
        if (err) {
          errors[i] = err
          out[i] = err
        } else {
          out[i] = args
        }

        if (!--pending) {
          errors = compact(errors)
          return errors.length
            ? done(error(errors), out)
            : done(null, out)
        }
      })
    })
  }
}

/**
 * Wrap vo
 *
 * @param {Vo} vo
 * @return {Function}
 */

function Vo (v) {
  return function vo (args, done) {
    return v.apply(this, args.concat(function(err, v) {
      if (err) return done(error(err))
      return done.apply(null, arguments)
    }))
  }
}

/**
 * Catcher
 *
 * @param {Function} fn
 * @return {Function}
 */

function Catcher(fn) {
  return function catcher (err, args, done) {
    return wrapped(fn()).apply(this, [err].concat(args).concat(done))
  }
}

/**
 * Identity
 *
 * @param {Array} args
 * @param {Function} done
 */

function Identity (value) {
  return function identity (args, done) {
    return done(null, value)
  }
}

},{"./type":46,"err-candy":47,"lodash.compact":50,"wrapped":51}],44:[function(require,module,exports){
/**
 * Module Dependencies
 */

var compile = require('./compile')
var sliced = require('sliced')

/**
 * Export `Pipeline`
 */

module.exports = Pipeline

/**
 * Initialize `Pipeline`
 *
 * @param {Array} series array of functions
 * @param {Array} args
 * @param {Function} done
 */

function Pipeline (pipeline, context, args, done) {
  pipeline = pipeline.map(compile)

  // run in series
  function next (err) {
    if (err) return error(err, sliced(arguments, 1))
    var fn = pipeline.shift()
    while (fn && fn.length !== 2) fn = pipeline.shift()
    if (!fn) return done.call(context, null, sliced(arguments, 1))
    fn.call(context, sliced(arguments, 1), next)
  }

  // error handling
  function error (err, args) {
    var fn = pipeline.shift()
    while (fn && fn.length !== 3) fn = pipeline.shift()
    if (fn) return fn.call(context, err, args, next)
    else return done.call(context, err)
  }

  // kick us off
  next.apply(null, [null].concat(args))
}

},{"./compile":43,"sliced":41}],45:[function(require,module,exports){
/**
 * Module Dependencies
 */

var compile = require('./compile')

/**
 * Export `Stack`
 */

module.exports = Stack

/**
 * Initialize `Stack`
 *
 * @param {Array} series array of functions
 * @param {Array} args
 * @param {Function} done
 */

function Stack (stack, context, args, done) {
  stack = stack.map(compile)

  // run in stack
  function next (err) {
    if (err) return error(err)
    var fn = stack.shift()
    while (fn && fn.length !== 2) fn = stack.shift()
    if (!fn) return done.call(context, null, args)
    fn.call(context, args, next)
  }

  // error handling
  function error (err) {
    var fn = stack.shift()
    while (fn && fn.length !== 3) fn = stack.shift()
    if (fn) return fn.call(context, err, args, next)
    else return done.call(context, err)
  }

  // kick us off
  next()
}

},{"./compile":43}],46:[function(require,module,exports){
/**
 * Module dependencies
 */

var isArray = Array.isArray

/**
 * Export `type`
 */

module.exports = type

/**
 * Get the type
 *
 * @param {Mixed} v
 * @return {String}
 */

function type(v) {
  return isArray(v)
    ? 'array'
    : v && v.vo
    ? 'vo'
    : v && v.catch
    ? 'catch'
    : v === null
    ? 'null'
    : typeof v
}

},{}],47:[function(require,module,exports){
(function (process){
/**
 * Module dependencies
 */

var Stack = require('stack-utils')

/**
 * Export `error`
 */

module.exports = error

/**
 * Clean up or combine errors
 *
 * @param {Error|Array} errors
 * @return {Error}
 */

function error (errors) {
  errors = Array.isArray(errors) ? errors : [errors]
  return combine(errors)
}

/**
 * Initialize `combine`
 */

function combine (errors) {
  if (errors.length === 1) return improve(errors[0])

  errors = errors.map(function(error, i) {
    return improve(error)
  })

  var message = errors.map(function (error) {
    return error.message
  }).join('\n\n')

  var stack = errors.map(function (error) {
    return error.stack
  }).join('')

  var error = new Error()
  error.message = message
  error.stack = stack
  error.candy = true

  return error
}

/**
 * Improve the error
 *
 * @param {Error} err
 * @return {Error}
 */

function improve (err, prefix) {
  if (err.candy) return err

  prefix = prefix || '  \u2716 '

  // clean the stack
  var stack = clean(err.stack)

  // create a new error
  var error = new Error()
  error.candy = true

  // improve the message
  var message = normalize(err)
  error.message = prefix + message

  // improve the stack
  error.stack = stack
    ? prefix + message + '\n\n' + stack + '\n\n'
    : prefix + message + '\n\n'

  return error
}

/**
 * Normalize the message
 *
 * @param {Error} err
 * @return {String}
 */

function normalize (err) {
  if (err.codeFrame) { // babelify@6.x
    return [err.message, indent(err.codeFrame, 4)].join('\n\n')
  } else { // babelify@5.x and browserify
    return err.annotated || err.message
  }
}

/**
 * Clean the stack traces
 *
 * @param {String} stack
 * @return {String}
 */

function clean (stack) {
  return new Stack({
    internals: Stack.nodeInternals().concat(/\b\/node_modules\/babel-core\b/),
    cwd: process.cwd()
  })
  .clean(stack)
  .split('\n')
  .filter(function (line) { return line })
  .map(function (line) { return '    \u25B8 ' + line })
  .join('\n')
}

/**
 * Indent a bit
 *
 * @param {String} str
 * @return {String}
 */

function indent(str, n) {
  return str
    .split('\n')
    .map(function (line) { return repeat(' ', n) + line })
    .join('\n')
}

/**
 * Repeat a string a n times
 *
 * @param {String} str
 * @param {Number} n
 * @return {String}
 */

function repeat (str, n) {
  return new Array(n + 1).join(str)
}

}).call(this,require('_process'))
},{"_process":26,"stack-utils":48}],48:[function(require,module,exports){
(function (process){
module.exports = StackUtils;

function StackUtils(opts) {
	if (!(this instanceof StackUtils)) {
		throw new Error('StackUtils constructor must be called with new');
	}
	opts = opts || {};
	this._cwd = (opts.cwd || process.cwd()).replace(/\\/g, '/');
	this._internals = opts.internals || [];
}

module.exports.nodeInternals = nodeInternals;

function nodeInternals() {
	return [
		/\(native\)$/,
		/\(domain.js:\d+:\d+\)$/,
		/\(events.js:\d+:\d+\)$/,
		/\(node.js:\d+:\d+\)$/,
		/\(timers.js:\d+:\d+\)$/,
		/\(module.js:\d+:\d+\)$/,
		/\(internal\/[\w_-]+\.js:\d+:\d+\)$/,
		/\s*at node\.js:\d+:\d+?$/,
		/\/\.node-spawn-wrap-\w+-\w+\/node:\d+:\d+\)?$/
	];
}

StackUtils.prototype.clean = function (stack) {
	if (!Array.isArray(stack)) {
		stack = stack.split('\n');
	}

	if (!(/^\s*at /.test(stack[0])) &&
		(/^\s*at /.test(stack[1]))) {
		stack = stack.slice(1);
	}

	var outdent = false;
	var lastNonAtLine = null;
	var result = [];

	stack.forEach(function (st) {
		st = st.replace(/\\/g, '/');
		var isInternal = this._internals.some(function (internal) {
			return internal.test(st);
		});

		if (isInternal) {
			return null;
		}

		var isAtLine = /^\s*at /.test(st);

		if (outdent) {
			st = st.replace(/\s+$/, '').replace(/^(\s+)at /, '$1');
		} else {
			st = st.trim();
			if (isAtLine) {
				st = st.substring(3);
			}
		}

		st = st.replace(this._cwd + '/', '');

		if (st) {
			if (isAtLine) {
				if (lastNonAtLine) {
					result.push(lastNonAtLine);
					lastNonAtLine = null;
				}
				result.push(st);
			} else {
				outdent = true;
				lastNonAtLine = st;
			}
		}
	}, this);

	stack = result.join('\n').trim();

	if (stack) {
		return stack + '\n';
	}
	return '';
};

StackUtils.prototype.captureString = function (limit, fn) {
	if (typeof limit === 'function') {
		fn = limit;
		limit = Infinity;
	}
	if (!fn) {
		fn = this.captureString;
	}

	var limitBefore = Error.stackTraceLimit;
	if (limit) {
		Error.stackTraceLimit = limit;
	}

	var obj = {};

	Error.captureStackTrace(obj, fn);
	var stack = obj.stack;
	Error.stackTraceLimit = limitBefore;

	return this.clean(stack);
};

StackUtils.prototype.capture = function (limit, fn) {
	if (typeof limit === 'function') {
		fn = limit;
		limit = Infinity;
	}
	if (!fn) {
		fn = this.capture;
	}
	var prepBefore = Error.prepareStackTrace;
	var limitBefore = Error.stackTraceLimit;

	Error.prepareStackTrace = function (obj, site) {
		return site;
	};

	if (limit) {
		Error.stackTraceLimit = limit;
	}

	var obj = {};
	Error.captureStackTrace(obj, fn);
	var stack = obj.stack;
	Error.prepareStackTrace = prepBefore;
	Error.stackTraceLimit = limitBefore;

	return stack;
};

StackUtils.prototype.at = function at(fn) {
	if (!fn) {
		fn = at;
	}

	var site = this.capture(1, fn)[0];

	if (!site) {
		return {};
	}

	var res = {
		line: site.getLineNumber(),
		column: site.getColumnNumber()
	};

	this._setFile(res, site.getFileName());

	if (site.isConstructor()) {
		res.constructor = true;
	}

	if (site.isEval()) {
		res.evalOrigin = site.getEvalOrigin();
	}

	if (site.isNative()) {
		res.native = true;
	}

	var typename = null;
	try {
		typename = site.getTypeName();
	} catch (er) {}

	if (typename &&
		typename !== 'Object' &&
		typename !== '[object Object]') {
		res.type = typename;
	}

	var fname = site.getFunctionName();
	if (fname) {
		res.function = fname;
	}

	var meth = site.getMethodName();
	if (meth && fname !== meth) {
		res.method = meth;
	}

	return res;
};

StackUtils.prototype._setFile = function (result, filename) {
	if (filename) {
		filename = filename.replace(/\\/g, '/');
		if ((filename.indexOf(this._cwd + '/') === 0)) {
			filename = filename.substr(this._cwd.length + 1);
		}
		result.file = filename;
	}
};

var re = new RegExp(
	'^' +
		// Sometimes we strip out the '    at' because it's noisy
	'(?:\\s*at )?' +
		// $1 = ctor if 'new'
	'(?:(new) )?' +
		// Object.method [as foo] (, maybe
		// $2 = function name
		// $3 = method name
	'(?:([^\\(\\[]*)(?: \\[as ([^\\]]+)\\])? \\()?' +
		// (eval at <anonymous> (file.js:1:1),
		// $4 = eval origin
		// $5:$6:$7 are eval file/line/col, but not normally reported
	'(?:eval at ([^ ]+) \\(([^\\)]+):(\\d+):(\\d+)\\), )?' +
		// file:line:col
		// $8:$9:$10
		// $11 = 'native' if native
	'(?:([^\\)]+):(\\d+):(\\d+)|(native))' +
		// maybe close the paren, then end
	'\\)?$'
);

StackUtils.prototype.parseLine = function parseLine(line) {
	var match = line && line.match(re);
	if (!match) {
		return null;
	}

	var ctor = match[1] === 'new';
	var fname = match[2];
	var meth = match[3];
	var evalOrigin = match[4];
	var evalFile = match[5];
	var evalLine = Number(match[6]);
	var evalCol = Number(match[7]);
	var file = match[8];
	var lnum = match[9];
	var col = match[10];
	var native = match[11] === 'native';

	var res = {};

	if (lnum) {
		res.line = Number(lnum);
	}

	if (col) {
		res.column = Number(col);
	}

	this._setFile(res, file);

	if (ctor) {
		res.constructor = true;
	}

	if (evalOrigin) {
		res.evalOrigin = evalOrigin;
		res.evalLine = evalLine;
		res.evalColumn = evalCol;
		res.evalFile = evalFile && evalFile.replace(/\\/g, '/');
	}

	if (native) {
		res.native = true;
	}

	if (fname) {
		res.function = fname;
	}

	if (meth && fname !== meth) {
		res.method = meth;
	}

	return res;
};

var bound = new StackUtils();

Object.keys(StackUtils.prototype).forEach(function (key) {
	StackUtils[key] = bound[key].bind(bound);
});

}).call(this,require('_process'))
},{"_process":26}],49:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   3.1.2
 */

(function() {
    "use strict";
    function lib$es6$promise$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function lib$es6$promise$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function lib$es6$promise$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var lib$es6$promise$utils$$_isArray;
    if (!Array.isArray) {
      lib$es6$promise$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      lib$es6$promise$utils$$_isArray = Array.isArray;
    }

    var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
    var lib$es6$promise$asap$$len = 0;
    var lib$es6$promise$asap$$vertxNext;
    var lib$es6$promise$asap$$customSchedulerFn;

    var lib$es6$promise$asap$$asap = function asap(callback, arg) {
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
      lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
      lib$es6$promise$asap$$len += 2;
      if (lib$es6$promise$asap$$len === 2) {
        // If len is 2, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        if (lib$es6$promise$asap$$customSchedulerFn) {
          lib$es6$promise$asap$$customSchedulerFn(lib$es6$promise$asap$$flush);
        } else {
          lib$es6$promise$asap$$scheduleFlush();
        }
      }
    }

    function lib$es6$promise$asap$$setScheduler(scheduleFn) {
      lib$es6$promise$asap$$customSchedulerFn = scheduleFn;
    }

    function lib$es6$promise$asap$$setAsap(asapFn) {
      lib$es6$promise$asap$$asap = asapFn;
    }

    var lib$es6$promise$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
    var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
    var lib$es6$promise$asap$$isNode = typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

    // test for web worker but not in IE10
    var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function lib$es6$promise$asap$$useNextTick() {
      // node version 0.10.x displays a deprecation warning when nextTick is used recursively
      // see https://github.com/cujojs/when/issues/410 for details
      return function() {
        process.nextTick(lib$es6$promise$asap$$flush);
      };
    }

    // vertx
    function lib$es6$promise$asap$$useVertxTimer() {
      return function() {
        lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
      };
    }

    function lib$es6$promise$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function lib$es6$promise$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = lib$es6$promise$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function lib$es6$promise$asap$$useSetTimeout() {
      return function() {
        setTimeout(lib$es6$promise$asap$$flush, 1);
      };
    }

    var lib$es6$promise$asap$$queue = new Array(1000);
    function lib$es6$promise$asap$$flush() {
      for (var i = 0; i < lib$es6$promise$asap$$len; i+=2) {
        var callback = lib$es6$promise$asap$$queue[i];
        var arg = lib$es6$promise$asap$$queue[i+1];

        callback(arg);

        lib$es6$promise$asap$$queue[i] = undefined;
        lib$es6$promise$asap$$queue[i+1] = undefined;
      }

      lib$es6$promise$asap$$len = 0;
    }

    function lib$es6$promise$asap$$attemptVertx() {
      try {
        var r = require;
        var vertx = r('vertx');
        lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return lib$es6$promise$asap$$useVertxTimer();
      } catch(e) {
        return lib$es6$promise$asap$$useSetTimeout();
      }
    }

    var lib$es6$promise$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (lib$es6$promise$asap$$isNode) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
    } else if (lib$es6$promise$asap$$BrowserMutationObserver) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
    } else if (lib$es6$promise$asap$$isWorker) {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
    } else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertx();
    } else {
      lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
    }
    function lib$es6$promise$then$$then(onFulfillment, onRejection) {
      var parent = this;
      var state = parent._state;

      if (state === lib$es6$promise$$internal$$FULFILLED && !onFulfillment || state === lib$es6$promise$$internal$$REJECTED && !onRejection) {
        return this;
      }

      var child = new this.constructor(lib$es6$promise$$internal$$noop);
      var result = parent._result;

      if (state) {
        var callback = arguments[state - 1];
        lib$es6$promise$asap$$asap(function(){
          lib$es6$promise$$internal$$invokeCallback(state, child, callback, result);
        });
      } else {
        lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
      }

      return child;
    }
    var lib$es6$promise$then$$default = lib$es6$promise$then$$then;
    function lib$es6$promise$promise$resolve$$resolve(object) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$resolve(promise, object);
      return promise;
    }
    var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;

    function lib$es6$promise$$internal$$noop() {}

    var lib$es6$promise$$internal$$PENDING   = void 0;
    var lib$es6$promise$$internal$$FULFILLED = 1;
    var lib$es6$promise$$internal$$REJECTED  = 2;

    var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$selfFulfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function lib$es6$promise$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function lib$es6$promise$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
        return lib$es6$promise$$internal$$GET_THEN_ERROR;
      }
    }

    function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
       lib$es6$promise$asap$$asap(function(promise) {
        var sealed = false;
        var error = lib$es6$promise$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            lib$es6$promise$$internal$$resolve(promise, value);
          } else {
            lib$es6$promise$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          lib$es6$promise$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          lib$es6$promise$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, thenable._result);
      } else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, thenable._result);
      } else {
        lib$es6$promise$$internal$$subscribe(thenable, undefined, function(value) {
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      }
    }

    function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable, then) {
      if (maybeThenable.constructor === promise.constructor &&
          then === lib$es6$promise$then$$default &&
          constructor.resolve === lib$es6$promise$promise$resolve$$default) {
        lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        } else if (lib$es6$promise$utils$$isFunction(then)) {
          lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function lib$es6$promise$$internal$$resolve(promise, value) {
      if (promise === value) {
        lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFulfillment());
      } else if (lib$es6$promise$utils$$objectOrFunction(value)) {
        lib$es6$promise$$internal$$handleMaybeThenable(promise, value, lib$es6$promise$$internal$$getThen(value));
      } else {
        lib$es6$promise$$internal$$fulfill(promise, value);
      }
    }

    function lib$es6$promise$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      lib$es6$promise$$internal$$publish(promise);
    }

    function lib$es6$promise$$internal$$fulfill(promise, value) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = lib$es6$promise$$internal$$FULFILLED;

      if (promise._subscribers.length !== 0) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, promise);
      }
    }

    function lib$es6$promise$$internal$$reject(promise, reason) {
      if (promise._state !== lib$es6$promise$$internal$$PENDING) { return; }
      promise._state = lib$es6$promise$$internal$$REJECTED;
      promise._result = reason;

      lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publishRejection, promise);
    }

    function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + lib$es6$promise$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, parent);
      }
    }

    function lib$es6$promise$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function lib$es6$promise$$internal$$ErrorObject() {
      this.error = null;
    }

    var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();

    function lib$es6$promise$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
        return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
      }
    }

    function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = lib$es6$promise$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = lib$es6$promise$$internal$$tryCatch(callback, detail);

        if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== lib$es6$promise$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        lib$es6$promise$$internal$$resolve(promise, value);
      } else if (failed) {
        lib$es6$promise$$internal$$reject(promise, error);
      } else if (settled === lib$es6$promise$$internal$$FULFILLED) {
        lib$es6$promise$$internal$$fulfill(promise, value);
      } else if (settled === lib$es6$promise$$internal$$REJECTED) {
        lib$es6$promise$$internal$$reject(promise, value);
      }
    }

    function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          lib$es6$promise$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          lib$es6$promise$$internal$$reject(promise, reason);
        });
      } catch(e) {
        lib$es6$promise$$internal$$reject(promise, e);
      }
    }

    function lib$es6$promise$promise$all$$all(entries) {
      return new lib$es6$promise$enumerator$$default(this, entries).promise;
    }
    var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
    function lib$es6$promise$promise$race$$race(entries) {
      /*jshint validthis:true */
      var Constructor = this;

      var promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (!lib$es6$promise$utils$$isArray(entries)) {
        lib$es6$promise$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
        return promise;
      }

      var length = entries.length;

      function onFulfillment(value) {
        lib$es6$promise$$internal$$resolve(promise, value);
      }

      function onRejection(reason) {
        lib$es6$promise$$internal$$reject(promise, reason);
      }

      for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        lib$es6$promise$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
      }

      return promise;
    }
    var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
    function lib$es6$promise$promise$reject$$reject(reason) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor(lib$es6$promise$$internal$$noop);
      lib$es6$promise$$internal$$reject(promise, reason);
      return promise;
    }
    var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;

    var lib$es6$promise$promise$$counter = 0;

    function lib$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function lib$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise's eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function lib$es6$promise$promise$$Promise(resolver) {
      this._id = lib$es6$promise$promise$$counter++;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if (lib$es6$promise$$internal$$noop !== resolver) {
        typeof resolver !== 'function' && lib$es6$promise$promise$$needsResolver();
        this instanceof lib$es6$promise$promise$$Promise ? lib$es6$promise$$internal$$initializePromise(this, resolver) : lib$es6$promise$promise$$needsNew();
      }
    }

    lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
    lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
    lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
    lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;
    lib$es6$promise$promise$$Promise._setScheduler = lib$es6$promise$asap$$setScheduler;
    lib$es6$promise$promise$$Promise._setAsap = lib$es6$promise$asap$$setAsap;
    lib$es6$promise$promise$$Promise._asap = lib$es6$promise$asap$$asap;

    lib$es6$promise$promise$$Promise.prototype = {
      constructor: lib$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: lib$es6$promise$then$$default,

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;
    function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
      this._instanceConstructor = Constructor;
      this.promise = new Constructor(lib$es6$promise$$internal$$noop);

      if (Array.isArray(input)) {
        this._input     = input;
        this.length     = input.length;
        this._remaining = input.length;

        this._result = new Array(this.length);

        if (this.length === 0) {
          lib$es6$promise$$internal$$fulfill(this.promise, this._result);
        } else {
          this.length = this.length || 0;
          this._enumerate();
          if (this._remaining === 0) {
            lib$es6$promise$$internal$$fulfill(this.promise, this._result);
          }
        }
      } else {
        lib$es6$promise$$internal$$reject(this.promise, this._validationError());
      }
    }

    lib$es6$promise$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function() {
      var length  = this.length;
      var input   = this._input;

      for (var i = 0; this._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
        this._eachEntry(input[i], i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var c = this._instanceConstructor;
      var resolve = c.resolve;

      if (resolve === lib$es6$promise$promise$resolve$$default) {
        var then = lib$es6$promise$$internal$$getThen(entry);

        if (then === lib$es6$promise$then$$default &&
            entry._state !== lib$es6$promise$$internal$$PENDING) {
          this._settledAt(entry._state, i, entry._result);
        } else if (typeof then !== 'function') {
          this._remaining--;
          this._result[i] = entry;
        } else if (c === lib$es6$promise$promise$$default) {
          var promise = new c(lib$es6$promise$$internal$$noop);
          lib$es6$promise$$internal$$handleMaybeThenable(promise, entry, then);
          this._willSettleAt(promise, i);
        } else {
          this._willSettleAt(new c(function(resolve) { resolve(entry); }), i);
        }
      } else {
        this._willSettleAt(resolve(entry), i);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var promise = this.promise;

      if (promise._state === lib$es6$promise$$internal$$PENDING) {
        this._remaining--;

        if (state === lib$es6$promise$$internal$$REJECTED) {
          lib$es6$promise$$internal$$reject(promise, value);
        } else {
          this._result[i] = value;
        }
      }

      if (this._remaining === 0) {
        lib$es6$promise$$internal$$fulfill(promise, this._result);
      }
    };

    lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      lib$es6$promise$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
      });
    };
    function lib$es6$promise$polyfill$$polyfill() {
      var local;

      if (typeof global !== 'undefined') {
          local = global;
      } else if (typeof self !== 'undefined') {
          local = self;
      } else {
          try {
              local = Function('return this')();
          } catch (e) {
              throw new Error('polyfill failed because global object is unavailable in this environment');
          }
      }

      var P = local.Promise;

      if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
        return;
      }

      local.Promise = lib$es6$promise$promise$$default;
    }
    var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;

    var lib$es6$promise$umd$$ES6Promise = {
      'Promise': lib$es6$promise$promise$$default,
      'polyfill': lib$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define(function() { return lib$es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = lib$es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
    }

    lib$es6$promise$polyfill$$default();
}).call(this);


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":26}],50:[function(require,module,exports){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Creates an array with all falsey values removed. The values `false`, `null`,
 * `0`, `""`, `undefined`, and `NaN` are falsey.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to compact.
 * @returns {Array} Returns the new array of filtered values.
 * @example
 *
 * _.compact([0, 1, false, 2, '', 3]);
 * // => [1, 2, 3]
 */
function compact(array) {
  var index = -1,
      length = array ? array.length : 0,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (value) {
      result[resIndex++] = value;
    }
  }
  return result;
}

module.exports = compact;

},{}],51:[function(require,module,exports){
/**
 * Module Dependencies
 */

var sliced = require('sliced');
var noop = function(){};
var co = require('co');

/**
 * Export `wrapped`
 */

module.exports = wrapped;

/**
 * Wrap a function to support
 * sync, async, and gen functions.
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

function wrapped(fn) {
  function wrap() {
    var args = sliced(arguments);
    var last = args[args.length - 1];
    var ctx = this;

    // done
    var done = typeof last == 'function' ? args.pop() : noop;

    // nothing
    if (!fn) {
      return done.apply(ctx, [null].concat(args));
    }

    // generator
    if (generator(fn)) {
      return co(fn).apply(ctx, args.concat(done));
    }

    // async
    if (fn.length > args.length) {
      // NOTE: this only handles uncaught synchronous errors
      try {
        return fn.apply(ctx, args.concat(done));
      } catch (e) {
        return done(e);
      }
    }

    // sync
    return sync(fn, done).apply(ctx, args);
  }

  return wrap;
}

/**
 * Wrap a synchronous function execution.
 *
 * @param {Function} fn
 * @param {Function} done
 * @return {Function}
 * @api private
 */

function sync(fn, done) {
  return function () {
    var ret;

    try {
      ret = fn.apply(this, arguments);
    } catch (err) {
      return done(err);
    }

    if (promise(ret)) {
      ret.then(function (value) { done(null, value); }, done);
    } else {
      ret instanceof Error ? done(ret) : done(null, ret);
    }
  }
}

/**
 * Is `value` a generator?
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function generator(value) {
  return value
    && value.constructor
    && 'GeneratorFunction' == value.constructor.name;
}


/**
 * Is `value` a promise?
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function promise(value) {
  return value && 'function' == typeof value.then;
}

},{"co":52,"sliced":41}],52:[function(require,module,exports){

/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

module.exports = co;

/**
 * Wrap the given generator `fn` and
 * return a thunk.
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

function co(fn) {
  var isGenFun = isGeneratorFunction(fn);

  return function (done) {
    var ctx = this;

    // in toThunk() below we invoke co()
    // with a generator, so optimize for
    // this case
    var gen = fn;

    // we only need to parse the arguments
    // if gen is a generator function.
    if (isGenFun) {
      var args = slice.call(arguments), len = args.length;
      var hasCallback = len && 'function' == typeof args[len - 1];
      done = hasCallback ? args.pop() : error;
      gen = fn.apply(this, args);
    } else {
      done = done || error;
    }

    next();

    // #92
    // wrap the callback in a setImmediate
    // so that any of its errors aren't caught by `co`
    function exit(err, res) {
      setImmediate(function(){
        done.call(ctx, err, res);
      });
    }

    function next(err, res) {
      var ret;

      // multiple args
      if (arguments.length > 2) res = slice.call(arguments, 1);

      // error
      if (err) {
        try {
          ret = gen.throw(err);
        } catch (e) {
          return exit(e);
        }
      }

      // ok
      if (!err) {
        try {
          ret = gen.next(res);
        } catch (e) {
          return exit(e);
        }
      }

      // done
      if (ret.done) return exit(null, ret.value);

      // normalize
      ret.value = toThunk(ret.value, ctx);

      // run
      if ('function' == typeof ret.value) {
        var called = false;
        try {
          ret.value.call(ctx, function(){
            if (called) return;
            called = true;
            next.apply(ctx, arguments);
          });
        } catch (e) {
          setImmediate(function(){
            if (called) return;
            called = true;
            next(e);
          });
        }
        return;
      }

      // invalid
      next(new TypeError('You may only yield a function, promise, generator, array, or object, '
        + 'but the following was passed: "' + String(ret.value) + '"'));
    }
  }
}

/**
 * Convert `obj` into a normalized thunk.
 *
 * @param {Mixed} obj
 * @param {Mixed} ctx
 * @return {Function}
 * @api private
 */

function toThunk(obj, ctx) {

  if (isGeneratorFunction(obj)) {
    return co(obj.call(ctx));
  }

  if (isGenerator(obj)) {
    return co(obj);
  }

  if (isPromise(obj)) {
    return promiseToThunk(obj);
  }

  if ('function' == typeof obj) {
    return obj;
  }

  if (isObject(obj) || Array.isArray(obj)) {
    return objectToThunk.call(ctx, obj);
  }

  return obj;
}

/**
 * Convert an object of yieldables to a thunk.
 *
 * @param {Object} obj
 * @return {Function}
 * @api private
 */

function objectToThunk(obj){
  var ctx = this;
  var isArray = Array.isArray(obj);

  return function(done){
    var keys = Object.keys(obj);
    var pending = keys.length;
    var results = isArray
      ? new Array(pending) // predefine the array length
      : new obj.constructor();
    var finished;

    if (!pending) {
      setImmediate(function(){
        done(null, results)
      });
      return;
    }

    // prepopulate object keys to preserve key ordering
    if (!isArray) {
      for (var i = 0; i < pending; i++) {
        results[keys[i]] = undefined;
      }
    }

    for (var i = 0; i < keys.length; i++) {
      run(obj[keys[i]], keys[i]);
    }

    function run(fn, key) {
      if (finished) return;
      try {
        fn = toThunk(fn, ctx);

        if ('function' != typeof fn) {
          results[key] = fn;
          return --pending || done(null, results);
        }

        fn.call(ctx, function(err, res){
          if (finished) return;

          if (err) {
            finished = true;
            return done(err);
          }

          results[key] = res;
          --pending || done(null, results);
        });
      } catch (err) {
        finished = true;
        done(err);
      }
    }
  }
}

/**
 * Convert `promise` to a thunk.
 *
 * @param {Object} promise
 * @return {Function}
 * @api private
 */

function promiseToThunk(promise) {
  return function(fn){
    promise.then(function(res) {
      fn(null, res);
    }, fn);
  }
}

/**
 * Check if `obj` is a promise.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isPromise(obj) {
  return obj && 'function' == typeof obj.then;
}

/**
 * Check if `obj` is a generator.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGenerator(obj) {
  return obj && 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGeneratorFunction(obj) {
  return obj && obj.constructor && 'GeneratorFunction' == obj.constructor.name;
}

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject(val) {
  return val && Object == val.constructor;
}

/**
 * Throw `err` in a new stack.
 *
 * This is used when co() is invoked
 * without supplying a callback, which
 * should only be for demonstrational
 * purposes.
 *
 * @param {Error} err
 * @api private
 */

function error(err) {
  if (!err) return;
  setImmediate(function(){
    throw err;
  });
}

},{}]},{},[2]);
