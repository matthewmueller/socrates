
  ![socrates](https://cldup.com/42vmtchht8.png)

  Small (8kb), batteries-included [redux](https://github.com/reactjs/redux) store to reduce boilerplate and promote good habits.

## Example

```js
var Store = require('socrates')

// create a store
var store = Store(reducer)

// subscribe to updates
store.subscribe(listener)

// dispatch an action
store('change user.name', { name: 'an' })
```

## Installation

```bash
npm install socrates
```

## Context

Redux pushed us forward in 2 key ways:

  **I. Promoting a single state architecture**

  **II. Using an actions dispatcher to update that state**

The state management in Redux is verbose, but fantastic. Socrates aims to supplement Redux's state management to reduce keystokes and transparently combine a few confusing concepts together. Namely, **combineReducer**, **FSA**, **redux-actions**, and **updeep**.

## Principles

#### I. State should be separate from the action log (redux middleware)

Socrates is only used to update state. Action logging is actually a much bigger part of application architecture than just updating state. Unfortunately, if you're new to Redux or just reading tutorials, you'll assume that actions are only used to update state. You should be dispatching actions to make HTTP requests, setup Websockets, and **all other side effects**. While you can do this in Redux's middleware, it's flow is mind-bending because Redux's middleware is synchronous, so you need to internally re-dispatch to achieve asynchronous behavior.

I have a version of middleware inspired by Koa's middleware done on the server that I'll be releasing soon to help you out with this.

#### II. Changes are *always* synchronous

Leave the the asynchrony to the action log (redux middleware). State changes that are rejected will throw errors.

#### III. Enforce a standard action object

Additionally, Socrates enforces that the returned result is a [Flux Standard Action](https://github.com/acdlite/flux-standard-action#actions), so our actions all have the same format.

This greatly slight constraint goes a long ways towards better interoperability.

#### IV. All state is frozen (in development)

Wherever you can access state in Socrates it is frozen, or in other words, read-only. This eliminates any possibility of modified references causing unexpected changes to our state.

By freezing state only in development, it steers our code towards the immutable direction without handicapping performance in production.

#### V. Reducers do not replace state, they update state

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

#### VI. Use reducer trees for modular and efficient reducer functions

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

#### `store = Socrates(reducer: object|function)`

Create a store instance with an optional middleware array and a reducer.
If the reducer is an object, it will create a reducer tree.

#### `store(action: mixed, ...): state`

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
```

#### `store(): Object`

Getting our state. This will be frozen in development

#### `store.subscribe(listener: function)`

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
