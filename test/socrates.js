'use strict'

/**
 * Module Dependencies
 */

var assert = require('assert')
var Socrates = require('..')

/**
 * Tests
 */

describe('Socrates', function () {
  describe('updates', function () {
    it('should work with no reducer', function () {
      var store = Socrates()
      let state = store({
        type: 'create user',
        payload: {
          name: 'matt',
          age: 26
        }
      })
      assert.deepEqual(state, { name: 'matt', age: 26 })

      state = store({
        type: 'update user',
        payload: {
          name: 'an',
          age: 26
        }
      })
      assert.deepEqual(state, { name: 'an', age: 26 })
    })

    it('should perform updates', function () {
      var store = Socrates(function (state, action) {
        if (state.name === 'matt') return { name: action.payload.name }
        else return action.payload
      })

      let state = store({ type: 'create', payload: { name: 'matt', age: 26 } })
      state = store({ type: 'create', payload: { name: 'michael', age: 20 } })
      assert.deepEqual(state, {
        name: 'michael',
        age: 26
      })
    })

    it('should clear out null values', function () {
      var store = Socrates(function (state, action) {
        return action.payload
      })

      let state = store({ type: 'create', payload: { name: 'matt', age: 26 } })
      state = store({ type: 'delete', payload: { name: null, age: 20 } })
      assert.deepEqual(state, {
        age: 20
      })
    })

    it('should not allow you to operate on state in the reducer', function () {
      var store = Socrates(function (state, action) {
        if (action.payload && action.payload.name) {
          state.name = action.payload.name
        }
      })

      try {
        store({ type: 'create', payload: { name: 'matt', age: 26 } })
        throw new Error('this shouldnt succeed')
      } catch (err) {
        includes(err.message, "Can't add property name, object is not extensible")
      }
    })
  })

  describe('resolve actions', function () {
    it('should resolve functions', function () {
      var store = Socrates()

      let state = store(function (state) {
        return {
          type: 'create',
          payload: {
            name: 'ted',
            age: 25
          }
        }
      })

      assert.deepEqual(state, {
        name: 'ted',
        age: 25
      })
    })

    it('should not allow you to change the state', function () {
      var store = Socrates()

      try {
        store(function (state) { state.name = 'matt' })
        throw new Error('this shouldnt succeed')
      } catch (err) {
        includes(err.message, "Can't add property name, object is not extensible")
      }
    })

    it('should ensure that what you return is a standard flux action', function () {
      var store = Socrates()
      try {
        store(function (state) { return { name: 'matt' } })
        throw new Error('this shouldnt succeed')
      } catch (err) {
        includes(err.message, 'resolved action ({"name":"matt"}) is not the correct format')
      }
    })
  })

  describe('simple dispatch', function () {
    it('should support a simple dispatch under certain conditions', function () {
      var store = Socrates()
      let state = store('change name', { name: 'matt', age: 26 })
      assert.deepEqual(state, {
        name: 'matt',
        age: 26
      })
    })

    it('should merge the payload', function () {
      var store = Socrates()
      let state = store('change name', { name: 'matt' }, { age: 26 })
      assert.deepEqual(state, {
        name: 'matt',
        age: 26
      })
    })
  })

  describe('subscribe', function () {
    it('should support subscribers', function (done) {
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
    })

    it('should prevent state changes in a subscriber', function () {
      var store = Socrates()

      store.subscribe(function (state) {
        assert.deepEqual(state, { name: 'matt', age: 26 })
      })

      store.subscribe(function (state) {
        state.name = 'martha'
      })

      try {
        store('create', { name: 'matt', age: 26 })
        throw new Error('this shouldnt happen')
      } catch (err) {
        includes(err.message, "Cannot assign to read only property 'name'")
      }
    })
  })

  describe('reducer tree', function () {
    it('should support reducer trees', function () {
      var store = Socrates({
        boot: function (state, action) {
          return action
        },
        user: {
          age: {
            bump (state, action) {
              assert.deepEqual(state, 26)
              assert.deepEqual(action, 1)
              return state + action
            }
          }
        }
      })

      let state = store({ type: 'boot', payload: { user: { name: 'matt', age: 26 } } })
      assert.deepEqual(state, { user: { name: 'matt', age: 26 } })
      state = store({ type: 'bump user.age', payload: 1 })
      assert.deepEqual(state, { user: { name: 'matt', age: 27 } })
    })

    it('should support nested actions', function () {
      let called = false
      var store = Socrates({
        boot: function (state, action) {
          return action
        },
        user: {
          update (state, action) {
            return action
          },
          settings: {
            change (state, action) {
              called = true
              assert.deepEqual(state, { theme: 'red' })
              assert.deepEqual(action, { theme: 'blue' })
              return action
            }
          }
        }
      })

      let state = store({ type: 'boot', payload: { user: { name: 'matt', age: 26, settings: { theme: 'red' } } } })
      assert.deepEqual(state, { user: { name: 'matt', age: 26, settings: { theme: 'red' } } })
      state = store({ type: 'change user.settings', payload: { theme: 'blue' } })
      assert.deepEqual(state, { user: { name: 'matt', age: 26, settings: { theme: 'blue' } } })
      assert.ok(called)
    })

    it('should support multiple inner values (#8)', function () {
      let store = Socrates({
        boot (state, action) {
          return action
        },
        user: {
          update (state, action) {
            return action
          },
          settings: {
            update (state, action) {
              return action
            }
          },
          theme: {
            update (state, action) {
              return action
            }
          }
        }
      })

      store({ type: 'boot', payload: { user: { name: 'matt' } } })
      assert.deepEqual(store(), {
        user: {
          name: 'matt'
        }
      })

      store({ type: 'update user.settings', payload: { password: 'lol' } })
      assert.deepEqual(store(), {
        user: {
          name: 'matt',
          settings: {
            password: 'lol'
          }
        }
      })

      store({ type: 'update user.theme', payload: { color: 'red' } })
      assert.deepEqual(store(), {
        user: {
          name: 'matt',
          settings: {
            password: 'lol'
          },
          theme: {
            color: 'red'
          }
        }
      })
    })

    it('should support updating arrays (#14)', function () {
      const store = Socrates({
        boot (state, action) {
          return action
        },
        condos: {
          add (state, action) {
            return state.concat(action)
          }
        }
      })

      store({
        type: 'boot',
        payload: {
          name: 'matt',
          condos: [
            { id: 1, name: 'Tierras del cafe', subdomain: 'tierrasdelcafe' },
            { id: 2, name: 'Real Santa Maria', subdomain: 'realsantamaria' },
            { id: 3, name: 'San Agusting', subdomain: 'sanagusting' }
          ]
        }
      })

      store(function (state) {
        return {
          type: 'add condos',
          payload: [{ id: 4, name: 'Villa Real', subdomain: 'villareal' }]
        }
      })

      assert.deepEqual(store(), {
        name: 'matt',
        condos: [
          { id: 1, name: 'Tierras del cafe', subdomain: 'tierrasdelcafe' },
          { id: 2, name: 'Real Santa Maria', subdomain: 'realsantamaria' },
          { id: 3, name: 'San Agusting', subdomain: 'sanagusting' },
          { id: 4, name: 'Villa Real', subdomain: 'villareal' }
        ]
      })
    })
  })

  describe('getting state', function () {
    it('should support getting state', function () {
      var store = Socrates()

      store({ type: 'boot', payload: { name: 'matt', age: 26 } })
      store({ type: 'update', payload: { age: 27 } })
      assert.deepEqual(store(), { name: 'matt', age: 27 })
    })

    it('should be frozen', function () {
      var store = Socrates()
      store({ type: 'boot', payload: { name: 'matt', age: 26 } })
      let state = store()
      try {
        state.age = 27
        throw new Error('we shouldnt be here')
      } catch (err) {
        includes(err.message, "Cannot assign to read only property 'age'")
      }
    })
  })
})

/**
 * Includes error
 */

function includes (actual, expected) {
  if (!~actual.indexOf(expected)) {
    throw new Error(`"${actual}" does not contain "${expected}"`)
  }
}
