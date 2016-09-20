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
        type: 'set',
        payload: {
          name: 'matt',
          age: 26
        }
      })
      assert.deepEqual(state, { name: 'matt', age: 26 })

      state = store({
        type: 'set',
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

    it('should clear out objects that are set to null', function () {
      var store = Socrates()
      store({ type: 'set', payload: { name: 'matt', settings: { color: 'blue', theme: 'red' } } })
      store({ type: 'set', payload: { settings: null } })
      assert.deepEqual(store(), { name: 'matt' })
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
          type: 'set',
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
      let state = store('set user', { name: 'matt', age: 26 })
      assert.deepEqual(state, {
        user: {
          name: 'matt',
          age: 26
        }
      })
    })

    it('should allow an emitter of literal strings', function () {
      var store = Socrates()
      let state = store('set name', 'matt')
      assert.deepEqual(state, { name: 'matt' })
    })

    it('should allow an emitter of literal numbers', function () {
      var store = Socrates()
      let state = store('set user.age', 5)
      assert.deepEqual(state, { user: { age: 5 } })
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

      return store('set', { name: 'matt', age: 26 })
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
        store('set', { name: 'matt', age: 26 })
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
      state = store({ type: 'change:user.settings', payload: { theme: 'blue' } })
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

      store({ type: 'update:user.settings', payload: { password: 'lol' } })
      assert.deepEqual(store(), {
        user: {
          name: 'matt',
          settings: {
            password: 'lol'
          }
        }
      })

      store({ type: 'update:user.theme', payload: { color: 'red' } })
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
          type: 'add:condos',
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

    it.skip('should support shallow reducers with deeper types (fixes #17)', function () {
      const store = Socrates({
        user: {
          websites: {
            push (state, action) {
              assert.equal(state, undefined)
              assert.deepEqual(action, {
                profileUrl: 'http://google.com'
              })

              let websites = state || []
              return websites.concat(action)
            }
          }
        }
      })

      store({
        type: 'push user.websites.profileUrl',
        payload: 'http://google.com'
      })

      assert.deepEqual(store(), {
        user: {
          websites: {
            profileUrl: 'http://google.com'
          }
        }
      })
    })

    it('should support literal numbers', function () {
      let store = Socrates({
        boot (state, action) {
          return action
        }
      })

      store('boot', 7)
      store('boot', 5)
      assert.equal(store(), 5)
    })

    it('should support literal strings', function () {
      let store = Socrates({
        addons: {
          toggle (state, action) {
            return action
          }
        },
        boot (state, action) {
          return action
        }
      })

      store('boot', { addons: [] })
      store('toggle:addons', 'hello')
      assert.deepEqual(store(), { addons: 'hello' })
    })

    it('should just assign when theres no reducer for it', function () {
      let store = Socrates({})
      store('set:addons', [])
      store('set:url.path', 'some url')
      assert.deepEqual(store(), {
        addons: [],
        url: {
          path: 'some url'
        }
      })
    })

    it('should delete with set and a null payload', function () {
      let store = Socrates({})
      store('set:addons', [])
      store('set:addons', null)
      store('set:url.path', 'some url')
      assert.deepEqual(store(), {
        url: {
          path: 'some url'
        }
      })
    })
  })

  describe('getting state', function () {
    it('should support getting state', function () {
      var store = Socrates()

      store({ type: 'set', payload: { name: 'matt', age: 26 } })
      store({ type: 'set', payload: { age: 27 } })
      assert.deepEqual(store(), { name: 'matt', age: 27 })
    })

    it('should be frozen', function () {
      var store = Socrates()
      store({ type: 'set', payload: { name: 'matt', age: 26 } })
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
