
  ![socrates](https://cldup.com/42vmtchht8.png)

  Small (12kb), batteries-included [redux](https://github.com/reactjs/redux) stack to reduce boilerplate and promote good habits.

## Example

```js
var Store = require('socrates')

// create a store
var store = Store(reducer)

// subscribe to updates
store.subscribe(listener)

// dispatch an action
store.dispatch('change user.name', { name: 'an' })
  .catch(onerror)
```

## Installation

```bash
npm install socrates
```

## Principles

#### I. Resolve any asynchrony up front

This way the rest of your middleware can operate synchronously on
plain action objects. This allows us to easily reproduce our application
state by recording and replaying these plain actions.

To this end, Socrates supports dispatching promises, generators, asynchronous
and synchronous functions. It also support running actions in series and in parallel
or both for more complex pipelines. These pipelines are where your DOM effects and
other side-effects should live.

```js
store(function * (state) {
  var res = yield fetch('http://google.com')
  return {
    type: 'fetch',
    payload: {
      status: res.status,
      text: res.text
    }
  }
})
```

Additionally, Socrates enforces that the returned result is a [Flux Standard Action](https://github.com/acdlite/flux-standard-action#actions), so our actions all have the same format.

If you'd like more information on what's possible with Socrate's asynchronous flows. See [vo's](https://github.com/lapwinglabs/vo/blob/master/test/pipeline.js) tests for more details.

#### II. All state is frozen (in development)

Wherever you can access state in Socrates it is frozen, or in other words, read-only. This eliminates any possibility of modified references causing unexpected changes to our state.

By freezing state only in development, it steers our code towards the immutable direction without handicapping performance in production.

#### III. Reducers do not replace state, they update state

In normal redux, reducers replace state. In socrates, they update state.

So instead of replacing your state like this:

```js
function reducer (state, action) {
  return Object.assign({}, state, action.payload)
}
```

You can simply return a diff:

```js
function reducer (state, action) {
  return { phone: 8675309 }
}
```

And Socrates will efficiently update the state using code inspired by [updeep](https://github.com/substantial/updeep). To remove a field, you can pass `null` as the value.

#### IV. Dispatch always returns a Promise

By always returning a promise, it centralizes our error handling and gives us a way to hook into when dispatch finished.

```js
store({ type: 'change user', payload: { ... }})
  .then(success)
  .catch(failure)
```

#### V. Use reducer trees for modular and efficient reducer functions

Socrates includes an opinionated way to setup reducers, called a **reducer tree**.

Reducer trees make it very easy to zero in on the reducers you want to operate on the dispatched action. For those of you familiar with redux and it's ecosystem, it's basically as if [combineReducers](http://redux.js.org/docs/api/combineReducers.html) and [handleActions](https://github.com/acdlite/redux-actions#handleactionsreducermap-defaultstate) had a child, where the functions are the actions and the objects are the state's shape.

Here's an example:

```js
var store = Socrates({
  // run with type: "boot"
  boot(state, action) {
    return action
  },
  user: {
    // run with type: "update user"
    update(state, action) {
      return action
    },
    settings: {
      // run with type: "change user.settings"
      change(state, action) {
        // state & action only contain the relevate data
        // you only need to return an action, because socrates
        // updates, doesn't replace.
        // 3. state = { theme: "red" }
        // 4. action = { theme: "blue" }
        return action
      }
    }
  }
})

// 1. boot up socrates with our initial state
// 2. change the user settings
store(
  {
    type: 'boot',
    payload: {
      user: {
        name: 'matt',
        age: 26,
        settings: {
          theme: 'red'
        }
      }
    }
  },
  {
    type: 'change user.settings',
    payload: { theme: 'blue' }
  }
})
```

If you don't like this approach, you can always just pass your custom reducer
function into Socrates.

## API

#### `socrates = Socrates([ middleware: array ], reducer: object|function)`

Create a store instance with an optional middleware array and a reducer.
If the reducer is an object, it will create a reducer tree.

#### `socrates(action: mixed, ...): Promise`

Dispatches an action. Dispatching can take on many forms:

```js
// simple object dispatch
socrates({ type: 'change name', payload: { name: 'an' }})

// using an event emitter style
socrates('change name', { name: 'an' })

// dispatch multiple object in series
socrates(
  { type: 'change name', payload: { name: 'an' }},
  { type: 'change age', payload: { age: 26 }}
)

// dispatch multiple object in parallel
socrates([
  { type: 'change name', payload: { name: 'an' }},
  { type: 'change age', payload: { age: 26 }}
])

// using a function to dispatch an action
socrates(function (state) {
  return { type: 'change age', payload: { age: 26 }}
})

// using an asynchronous function to dispatch an action
socrates(function (state, fn) {
  setTimeout(function () {
    fn(null, { type: 'change age', payload: { age: 26 }})
  }, 1000)
})

// using a promise to dispatch an action
socrates(function (state) {
  return new Promise(function (success, failure) {
    return success({ type: 'change age', payload: { age: 26 }})
  })
})

// using a generator to dispatch an action
socrates(function * (state) {
  yield wait(1000)
  return { type: 'change age', payload: { age: 26 }}
})
```

#### `socrates(): Object`

Getting our state. This will be frozen in development

#### `socrates.subscribe(listener: function)`

Subscribe to changes in our store

```js
socrates.subscribe(function (new_state) {
  // ... do something with the new state
})
```

## Test

```
npm install
make test
```

## License

MIT
