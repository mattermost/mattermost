# SuperAgent

SuperAgent is a small progressive __client-side__ HTTP request library, and __Node.js__ module with the same API, sporting many high-level HTTP client features. View the [docs](http://visionmedia.github.io/superagent/).

![super agent](http://f.cl.ly/items/3d282n3A0h0Z0K2w0q2a/Screenshot.png)

## Installation

node:

```
$ npm install superagent
```

component:

```
$ component install visionmedia/superagent
```

Works with [browserify](https://github.com/substack/node-browserify) and should work with [webpack](https://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack)

```js
request
  .post('/api/pet')
  .send({ name: 'Manny', species: 'cat' })
  .set('X-API-Key', 'foobar')
  .set('Accept', 'application/json')
  .end(function(err, res){
    // Calling the end function will send the request
  });
```

## Supported browsers

Tested browsers:

- Latest Android
- Latest Firefox
- Latest Chrome
- IE10 through latest. IE9 with polyfills.
- Latest iPhone
- Latest Safari

Even though IE9 is supported, a polyfill for `window.FormData` is required for `.field()`, and `window.btoa` is needed to use basic auth.

# Plugins

SuperAgent is easily extended via plugins.

```js
var nocache = require('superagent-no-cache');
var request = require('superagent');
var prefix = require('superagent-prefix')('/static');

request
.get('/some-url')
.use(prefix) // Prefixes *only* this request
.use(nocache) // Prevents caching of *only* this request
.end(function(err, res){
    // Do something
});
```

Existing plugins:
 * [superagent-no-cache](https://github.com/johntron/superagent-no-cache) - prevents caching by including Cache-Control header
 * [superagent-prefix](https://github.com/johntron/superagent-prefix) - prefixes absolute URLs (useful in test environment)
 * [superagent-suffix](https://github.com/timneutkens1/superagent-suffix) - suffix URLs with a given path
 * [superagent-mock](https://github.com/M6Web/superagent-mock) - simulate HTTP calls by returning data fixtures based on the requested URL
 * [superagent-mocker](https://github.com/shuvalov-anton/superagent-mocker) — simulate REST API
 * [superagent-cache](https://github.com/jpodwys/superagent-cache) - SuperAgent with built-in, flexible caching (compatible with SuperAgent `1.x`)
 * [superagent-jsonapify](https://github.com/alex94puchades/superagent-jsonapify) - A lightweight [json-api](http://jsonapi.org/format/) client addon for superagent
 * [superagent-serializer](https://github.com/zzarcon/superagent-serializer) - Converts server payload into different cases
 * [superagent-use](https://github.com/koenpunt/superagent-use) - A client addon to apply plugins to all requests.
 * [superagent-httpbackend](https://www.npmjs.com/package/superagent-httpbackend) - stub out requests using AngularJS' $httpBackend syntax
 * [superagent-throttle](https://github.com/leviwheatcroft/superagent-throttle) - queues and intelligently throttles requests
 * [superagent-charset](https://github.com/magicdawn/superagent-charset) - add charset support for node's SuperAgent

Please prefix your plugin with `superagent-*` so that it can easily be found by others.

For SuperAgent extensions such as couchdb and oauth visit the [wiki](https://github.com/visionmedia/superagent/wiki).

## Running node tests

Install dependencies:

```shell
$ npm install
```
Run em!

```shell
$ make test
```

## Running browser tests

Install dependencies:

```shell
$ npm install
```

Start the test runner:

```shell
$ make test-browser-local
```

Visit `http://localhost:4000/__zuul` in your browser.

Edit tests and refresh your browser. You do not have to restart the test runner.


## Packaging Notes for Developers

**npm (for node)** is configured via the `package.json` file and the `.npmignore` file. Key metadata in the `package.json` file is the `version` field which should be changed according to semantic versioning and have a 1-1 correspondence with git tags. So for example, if you were to `git show v1.5.0:package.json | grep version`, you should see `"version": "1.5.0",` and this should hold true for every release. This can be handled via the `npm version` command. Be aware that when publishing, npm will presume the version being published should also be tagged in npm as `latest`, which is OK for normal incremental releases. For betas and minor/patch releases to older versions, be sure to include `--tag` appropriately to avoid an older release getting tagged as `latest`.

**npm (for browser standalone)** When we publish versions to npm, we run `make superagent.js` which generates the standalone `superagent.js` file via `browserify`, and this file is included in the package published to npm (but this file is never checked into the git repository). If users want to install via npm but serve a single `.js` file directly to the browser, the `node_modules/superagent/superagent.js` is a standalone browserified file ready to go for that purpose. It is not minified.

**npm (for browserify)** is handled via the `package.json` `browser` field which allows users to install SuperAgent via npm, reference it from their browser code with `require('superagent')`, and then build their own application bundle via `browserify`, which will use `lib/client.js` as the SuperAgent entrypoint.

**bower** is configured via the `bower.json` file. Bower installs files directly from git/github without any transformation.

**component** is configured via the `component.json` file.

## License

MIT
