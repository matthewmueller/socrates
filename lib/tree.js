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
