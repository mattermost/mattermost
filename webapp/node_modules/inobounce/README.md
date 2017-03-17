# iNoBounce
> Stop your iOS webapp from bouncing around when scrolling


## The problem

You've built a nice full-screen mobile webapp, complete with scrollable elements using the `-webkit-overflow-scrolling` property. Everything is great, however, when you scroll to the top or bottom of your scrollable element, the window exhibits rubber band-like behavior, revealing a gray tweed pattern. Sometimes, your scrollable element doesn't scroll at all, but the window still insists on bouncing around.

## The solution

No dependencies, no configuration, just include iNoBounce.

```html
<script src="inobounce.js"></script>
```

## Example

All you need is an element with `height` or `max-height`, `overflow: auto` and `-webkit-overflow-scrolling: touch`.

```html
<script src="inobounce.js"></script>

<style>
    ul {
        height: 115px;
        border: 1px solid gray;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
    }
</style>

<ul>
    <li>List Item 1</li>
    <li>List Item 2</li>
    <li>List Item 3</li>
    <li>List Item 4</li>
    <li>List Item 5</li>
    <li>List Item 6</li>
    <li>List Item 7</li>
    <li>List Item 8</li>
    <li>List Item 9</li>
    <li>List Item 10</li>
</ul>
```

See the `examples/` folder for more examples, including a full-screen list, a canvas drawing app, and a fully skinned iOS-style app.


## API

Loading `inobounce.js` will define the `iNoBounce` namespace. If the loading environment supports AMD, iNoBounce will register itself as a model and forgo defining the namespace.


* **iNoBounce.enable()**  
Enable iNoBounce. It's enabled by default on platforms that support `-webkit-overflow-scrolling`, so you only need to call this method if you explicitly disable it or want to enable it on a platform that doesn't support `-webkit-overflow-scrolling`.

* **iNoBounce.disable()**  
Disable iNoBounce.

* **iNoBounce.isEnabled()**  
Returns a boolean indicating if iNoBounce is enabled.


## Will it break my app that uses touch events like other solutions?

It shouldn't. iNoBounce includes an example of a canvas drawing app and has been used in conjunction with [Hammer.js] without affecting functionality.


## How does it work?

iNoBounce detects if the browser supports `-webkit-overflow-scrolling` by checking for the property on a fresh `CSSStyleDeclaration`. If it does, iNoBounce will listen to `touchmove` and selectively `preventDefault()` on move events that don't occur on a child of an element with `-webkit-overflow-scrolling: touch` set. In addition, iNoBounce will `preventDefault()` when the user is attemping to scroll past the bounds of a scrollable element, preventing rubberbanding on the element itself (an unavoidable caveat).


## Shoutouts

### How can I get that awesome iOS CSS skin from the app example?

Check out [iOCSS] for a lightweight and easy to use iOS skin for your mobile webapp.


### Tapping stuff has a delay, what the heck?

You need [FastClick] by [FT Labs].


### Now I want awesome multi-touch gestures too!

It's hammer time, baby. Check out [Hammer.js] from [Eight Media].


## License

iNoBounce is licensed under the permissive BSD license.


[iOCSS]: http://lazd.github.io/iOCSS/
[FastClick]: https://github.com/ftlabs/fastclick
[FT Labs]: http://labs.ft.com/
[Hammer.js]: http://eightmedia.github.io/hammer.js/
[Eight Media]: http://www.eight.nl/
