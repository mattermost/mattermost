# EventEmitter

Facebook's EventEmitter is a simple emitter implementation that prioritizes speed and simplicity. It is conceptually similar to other emitters like Node's EventEmitter, but the precise APIs differ. More complex abstractions like the event systems used on facebook.com and m.facebook.com can be built on top of EventEmitter as well DOM event systems.

## API Concepts

EventEmitter's API shares many concepts with other emitter APIs. When events are emitted through an emitter instance, all listeners for the given event type are invoked.

```js
var emitter = new EventEmitter();
emitter.addListener('event', function(x, y) { console.log(x, y); });
emitter.emit('event', 5, 10);  // Listener prints "5 10".
```

EventEmitters return a subscription for each added listener. Subscriptions provide a convenient way to remove listeners that ensures they are removed from the correct emitter instance.

```js
var subscription = emitter.addListener('event', listener);
subscription.remove();
```

## Usage

First install the `fbemitter` package via `npm`, then you can require or import it.

```js
var {EventEmitter} = require('fbemitter');
var emitter = new EventEmitter();

```

## Building from source

Once you have the repository cloned, building a copy of `fbemitter` is easy, just run `gulp build`. This assumes you've installed `gulp` globally with `npm install -g gulp`.

```sh
gulp build
```

## API

### `constructor()`

Create a new emitter using the class' constructor. It accepts no arguments.

```js
var {EventEmitter} = require('fbemitter');
var emitter = new EventEmitter();
```

### `addListener(eventType, callback)`

Register a specific callback to be called on a particular event. A token is returned that can be used to remove the listener.

```js
var token = emitter.addListener('change', (...args) => {
  console.log(...args);
});

emitter.emit('change', 10); // 10 is logged
token.remove();
emitter.emit('change', 10); // nothing is logged
```

### `once(eventType, callback)`

Similar to `addListener()` but the callback is removed after it is invoked once. A token is returned that can be used to remove the listener.

```js
var token = emitter.once('change', (...args) => {
  console.log(...args);
});

emitter.emit('change', 10); // 10 is logged
emitter.emit('change', 10); // nothing is logged
```

### `removeAllListeners(eventType)`

Removes all of the registered listeners. `eventType` is optional, if provided only listeners for that event type are removed.

```js
var token = emitter.addListener('change', (...args) => {
  console.log(...args);
});

emitter.removeAllListeners();
emitter.emit('change', 10); // nothing is logged
```

### `listeners(eventType)`

Return an array of listeners that are currently registered for the given event type.

### `emit(eventType, ...args)`

Emits an event of the given type with the given data. All callbacks that are listening to the particular event type will be notified.

```js
var token = emitter.addListener('change', (...args) => {
  console.log(...args);
});

emitter.emit('change', 10); // 10 is logged
```

### `__emitToSubscription(subscription, eventType, ...args)`

It is reasonable to extend `EventEmitter` in order to inject some custom logic that you want to do on every callback that is called during an emit, such as logging, or setting up error boundaries. `__emitToSubscription()` is exposed to make this possible.

```js
class MyEventEmitter extends EventEmitter {
  __emitToSubscription(subscription, eventType) {
    var args = Array.prototype.slice.call(arguments, 2);
    var start = Date.now();
    subscription.listener.apply(subscription.context, args);
    var time = Date.now() - start;
    MyLoggingUtility.log('callback-time', {eventType, time});
  }
}
```

And then you can create instances of `MyEventEmitter` and use it like a standard `EventEmitter`. If you just want to log on each emit and not on each callback called during an emit you can override `emit()` instead of this method.

## Contribute

The main purpose of this repository is to share Facebook's implementation of an emitter. Please see React's [contributing article](https://github.com/facebook/react/blob/master/CONTRIBUTING.md), which generally applies to `fbemitter`, if you are interested in submitting a pull request.
