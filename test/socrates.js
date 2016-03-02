'use strict'

/**
 * Module Dependencies
 */

var assert = require('assert')
var Socrates = require('..')

/**
 * Tests
 */

describe('Socrates', function() {

  describe('updates', function() {
    it('should work with no reducer', function() {
      var store = Socrates()
      return store({
        type: 'create user',
        payload: {
          name: 'matt',
          age: 26
        }
      })
      .then(function () {
        return store({
          type: 'create user',
          payload: {
            name: 'an',
            age: 26
          }
        })
      })
      .then(function (state) {
        assert.deepEqual(state, {
          name: 'an',
          age: 26
        })
      })
    })

    it('should perform updates', function() {
      var store = Socrates(function (state, action) {
        if (state.name === 'matt') return { name: action.payload.name }
        else return action.payload
      })

      return store({ type: 'create', payload: { name: 'matt', age: 26 }})
      .then(store({ type: 'create', payload: { name: 'michael', age: 20 }}))
      .then(function (state) {
        assert.deepEqual(state, {
          name: 'michael',
          age: 26
        })
      })
    })

    it('should clear out null values', function() {
      var store = Socrates(function (state, action) {
        return action.payload
      })

      return store({ type: 'create', payload: { name: 'matt', age: 26 }})
        .then(store({ type: 'delete', payload: { name: null, age: 20 }}))
        .then(function (state) {
          assert.deepEqual(state, {
            age: 20
          })
        })
    })

    it('should not allow you to operate on state in the reducer', function() {
      var store = Socrates(function (state, action) {
        if (action.payload && action.payload.name) {
          state.name = action.payload.name
        }
      })

      return store(
        { type: 'create', payload: { name: 'matt', age: 26 }}
      )
      .then(function () {
        throw new Error('this shouldnt succeed')
      })
      .catch(function (err) {
        includes(err.message, "Can't add property name, object is not extensible")
      })
    })
  })

  describe('resolve actions', function() {
    it('should resolve functions', function() {
      var store = Socrates()

      return store(function (state) {
        return {
          type: 'create',
          payload: {
            name: 'ted',
            age: 25
          }
        }
      })
      .then(function (state) {
        assert.deepEqual(state, {
          name: 'ted',
          age: 25
        })
      })
    })

    it('should resolve asynchronous functions', function() {
      var store = Socrates()
      return store(function (state, fn) {
        setTimeout(function() {
          fn(null, {
            type: 'create',
            payload: {
              name: 'ted',
              age: 25
            }
          })
        }, 100)
      })
      .then(function (state) {
        assert.deepEqual(state, {
          name: 'ted',
          age: 25
        })
      })
    })

    it('should resolve generators', function() {
      var store = Socrates()
      return store(function * (state) {
        yield wait(100)
        return {
          type: 'create',
          payload: {
            name: 'ted',
            age: 25
          }
        }
      })
      .then(function (state) {
        assert.deepEqual(state, {
          name: 'ted',
          age: 25
        })
      })
    })

    it('should resolve promises', function() {
      var store = Socrates()
      return store(function (state) {
        return new Promise(function (success, failure) {
          setTimeout(function () {
            success({
              type: 'create',
              payload: {
                name: 'ted',
                age: 25
              }
            })
          }, 100)
        })
      })
      .then(function (state) {
        assert.deepEqual(state, {
          name: 'ted',
          age: 25
        })
      })
    })

    it('should throw if we try to change state in a .then(fn)', function() {
      var store = Socrates()
      return store(function (state) {
        return {
          type: 'create',
          payload: {
            name: 'matt',
            age: 26
          }
        }
      })
      .then(function (state) {
        state.name = 'an'
      })
      .catch(function (err) {
        includes(err.message, "Cannot assign to read only property 'name'")
      })
    })

    it('should resolve serial actions', function() {
      var store = Socrates(function (state, action) {
        if (action.type === 'push') {
          return { order: [].concat(state.order).concat(action.payload.value) }
        } else {
          return action.payload
        }
      })

      return store(
        { type: 'boot', payload: { order: [] }},
        { type: 'push', payload: { value: 1 }},
        function * () {
          yield wait (100)
          return { type: 'push', payload: { value: 2 }}
        },
        { type: 'push', payload: { value: 3 }}
      )
      .then(function (state) {
        assert.deepEqual(state.order, [1, 2, 3])
      })
    })

    it('should resolve serial actions (using .call or .apply)', function() {
      var store = Socrates(function (state, action) {
        if (action.type === 'push') {
          return { order: [].concat(state.order).concat(action.payload.value) }
        } else {
          return action.payload
        }
      })

      return store.apply([
        { type: 'boot', payload: { order: [] }},
        { type: 'push', payload: { value: 1 }},
        function * () {
          yield wait (100)
          return { type: 'push', payload: { value: 2 }}
        },
        { type: 'push', payload: { value: 3 }}
      ])
      .then(function (state) {
        assert.deepEqual(state.order, [1, 2, 3])
      })
    })

    it('should push values in parallel', function() {
      var store = Socrates(function (state, action) {
        if (action.type === 'push') {
          return { order: [].concat(state.order).concat(action.payload.value) }
        } else {
          return action.payload
        }
      })

      return store({ type: 'boot', payload: { order: [] }})
        .then(function (state) {
          assert.deepEqual(state, { order: [] })
          return store([
            function * () {
              yield wait (300)
              return { type: 'push', payload: { value: 1 }}
            },
            function * () {
              yield wait (100)
              return { type: 'push', payload: { value: 2 }}
            },
            function * () {
              yield wait (200)
              return { type: 'push', payload: { value: 3 }}
            }
          ])
        })
        .then(function (state) {
          assert.deepEqual(state.order, [2, 3, 1])
        })
    })

    it('should string complex action pipelines together', function() {
      var store = Socrates(function (state, action) {
        if (action.type === 'push') {
          return { order: [].concat(state.order).concat(action.payload.value) }
        } else {
          return action.payload
        }
      })

      return store(
        { type: 'boot', payload: { order: [] }},
        [
          function * () {
            yield wait (300)
            return { type: 'push', payload: { value: 1 }}
          },
          function * () {
            yield wait (100)
            return { type: 'push', payload: { value: 2 }}
          },
          function * () {
            yield wait (200)
            return { type: 'push', payload: { value: 3 }}
          }
        ]
      )
      .then(function (state) {
        assert.deepEqual(state.order, [2, 3, 1])
      })
    })

    it('should not allow you to change the state', function() {
      var store = Socrates()
      return store(function (state) {
        state.name = 'matt'
      })
      .then(function () {
        throw new Error('this shouldnt succeed')
      })
      .catch(function (err) {
        includes(err.message, "Can't add property name, object is not extensible")
      })
    })

    it('should ensure that what you return is a standard flux action', function() {
      var store = Socrates()
      return store(function (state) {
        return { name: 'matt' }
      })
      .then(function () {
        throw new Error('this shouldnt succeed')
      })
      .catch(function (err) {
        includes(err.message, 'resolved action ({"name":"matt"}) is not the correct format')
      })
    })
  })

  describe('simple dispatch', function() {
    it('should support a simple dispatch under certain conditions', function() {
      var store = Socrates()
      return store('change name', { name: 'matt', age: 26 })
        .then(function (state) {
          assert.deepEqual(state, {
            name: 'matt',
            age: 26
          })
        })
    })

    it('should merge the payload', function() {
      var store = Socrates()
      return store('change name', { name: 'matt' }, { age: 26 })
        .then(function (state) {
          assert.deepEqual(state, {
            name: 'matt',
            age: 26
          })
        })
    })
  })

  describe('subscribe', function() {
    it('should support subscribers', function(done) {
      var store = Socrates()
      var pending = 2

      store.subscribe(function (state) {
        assert.deepEqual(state, { name: 'matt', age: 26 })
        if (!--pending) return done()
      })

      store.subscribe(function (state) {
        assert.deepEqual(state, { name: 'matt', age: 26 })
        if (!--pending) return done()
      })

      return store('create', { name: 'matt', age: 26 })
        .catch(done)
    })

    it('should prevent state changes in a subscriber', function() {
      var store = Socrates()
      var pending = 2

      store.subscribe(function (state) {
        assert.deepEqual(state, { name: 'matt', age: 26 })
      })

      store.subscribe(function (state) {
        state.name = 'martha'
      })

      return store('create', { name: 'matt', age: 26 })
        .then(function () {
          throw new Error('this shouldnt happen')
        })
        .catch(function (err) {
          includes(err.message, "Cannot assign to read only property 'name'")
        })
    })
  })

  describe('middleware', function() {
    it('should support passing middleware through', function() {
      var store = Socrates([slothware()])
      return store({
        type: 'boot',
        payload: {
          name: 'noodles',
          age: 25
        }
      })
      .then(function (state) {
        assert.deepEqual(state, {
          name: 'noodles, the sloth',
          age: 25
        })
      })
    })
  })

  describe('reducer tree', function() {
    it('should support reducer trees', function() {
      var store = Socrates({
        boot: function (state, action) {
          return action
        },
        user: {
          age: {
            bump(state, action) {
              assert.deepEqual(state, 26)
              assert.deepEqual(action, 1)
              return state + action
            }
          }
        }
      })

      return store({ type: 'boot', payload: { user: { name: 'matt', age: 26 } } })
        .then(function (state) {
          assert.deepEqual(state, { user: { name: 'matt', age: 26 }})
          return store({ type: 'bump user.age', payload: 1 })
        })
        .then(function (state) {
          assert.deepEqual(state, { user: { name: 'matt', age: 27 }})
        })
    })

    it('should support nested actions', function() {
      var store = Socrates({
        boot: function (state, action) {
          return action
        },
        user: {
          update(state, action) {
            return action
          },
          settings: {
            change(state, action) {
              assert.deepEqual(state, { theme: 'red' })
              assert.deepEqual(action, { theme: 'blue' })
              return action
            }
          }
        }
      })

      return store({ type: 'boot', payload: { user: { name: 'matt', age: 26, settings: { theme: 'red' } } } })
        .then(function (state) {
          assert.deepEqual(state, { user: { name: 'matt', age: 26, settings: { theme: 'red' } }})
          return store({ type: 'change user.settings', payload: { theme: 'blue' } })
        })
        .then(function (state) {
          assert.deepEqual(state, { user: { name: 'matt', age: 26, settings: { theme: 'blue' } }})
        })
    })
  })

  describe('getting state', function() {
    it('should support getting state', function() {
      var store = Socrates()
      return store({ type: 'boot', payload: { name: 'matt', age: 26 }})
        .then(function () {
          return store({ type: 'update', payload: { age: 27 }})
        })
        .then(function () {
          assert.deepEqual(store(), { name: 'matt', age: 27 })
        })
    })

    it('should be frozen', function() {
      var store = Socrates()

      return store({ type: 'boot', payload: { name: 'matt', age: 26 } })
        .then(function () {
          var state = store()
          try {
            state.age = 27
            throw new Error('we shouldnt be here')
          } catch (err) {
            includes(err.message, "Cannot assign to read only property 'age'")
          }
        })
    })
  })
})

/**
 * Slothware - the best kind of middleware
 */

function slothware () {
  return function (store) {
    return function (next) {
      return function (action) {
        action.payload.name = action.payload.name + ', the sloth'
        next(action)
      }
    }
  }
}

/**
 * timeout thunk
 */

function wait (ms) {
  return function (fn) {
    setTimeout(fn, ms)
  }
}

/**
 * Includes error
 */

function includes (actual, expected) {
  if (!~actual.indexOf(expected)) {
    throw new Error(`"${actual}" does not contain "${expected}"`)
  }
}
