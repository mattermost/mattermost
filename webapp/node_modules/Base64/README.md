# Base64.js

≈ 500 byte* polyfill for browsers which don't provide [`window.btoa`][1] and
[`window.atob`][2].

Although the script does no harm in browsers which do provide these functions,
a conditional script loader such as [yepnope][3] can prevent unnecessary HTTP
requests.

```javascript
yepnope({
  test: window.btoa && window.atob,
  nope: 'base64.js',
  callback: function () {
    // `btoa` and `atob` are now safe to use
  }
})
```

Base64.js stems from a [gist][4] by [yahiko][5].

### Running the test suite

    make setup
    make test

\* Minified and gzipped. Run `make bytes` to verify.


[1]: https://developer.mozilla.org/en/DOM/window.btoa
[2]: https://developer.mozilla.org/en/DOM/window.atob
[3]: http://yepnopejs.com/
[4]: https://gist.github.com/229984
[5]: https://github.com/yahiko
