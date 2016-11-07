# raf

[![Browser Support](http://ci.testling.com/chrisdickinson/raf.png)](http://ci.testling.com/chrisdickinson/raf)

requestAnimationFrame polyfill for node and the browser.

```js
var raf = require('raf')

raf(function tick() {
  // Animation logic
  raf(tick)
})
```

**Note:** The stream/event emitter logic found in versions prior to 1.0.0 can be found in [raf-stream](https://www.npmjs.org/package/raf-stream).

# API

[Documentation at Mozilla Developer Network](https://developer.mozilla.org/en-US/docs/Web/API/window.requestAnimationFrame), [W3 Specification](http://www.w3.org/TR/animation-timing/#requestAnimationFrame)

```js
var raf = require('raf')
```

## var handle = raf(callback)

`callback` is the function to invoke in the next frame. `handle` is a long integer value that uniquely identifies the entry in the callback list. This is a non-zero value, but you may not make any other assumptions about its value.

## raf.cancel(handle)

`handle` is the entry identifier returned by `raf()`. Removes the queued animation frame callback (other queued callbacks will still be invoked unless cancelled).

## raf.polyfill()

Shorthand to polyfill `window.requestAnimationFrame` and `window.cancelAnimationFrame` if necessary (Polyfills `global` in node).

Alternatively you can require `raf/polyfill` which will act the same as `require('raf').polyfill()`.

# Acknowledgments

Based on work by Erik Möller, Paul Irish, and Tino Zijdel (https://gist.github.com/paulirish/1579671)

# license

MIT
