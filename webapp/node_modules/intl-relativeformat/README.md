Intl RelativeFormat
===================

Formats JavaScript dates to relative time strings (e.g., "3 hours ago").

[![npm Version][npm-badge]][npm]
[![Build Status][travis-badge]][travis]
[![Dependency Status][david-badge]][david]

[![Sauce Test Status][sauce-badge]][sauce]


Overview
--------

### Goals

This package aims to provide a way to format different variations of relative time. You can use this package in the browser and on the server via Node.js.

This implementation is very similar to [moment.js][], in concept, although it provides only formatting features based on the Unicode [CLDR][] locale data, an industry standard that supports more than 200 languages.

_Note: This `IntlRelativeFormat` API may change to stay in sync with ECMA-402, but this package will follow [semver][]._

### How It Works

This API is very similar to [ECMA 402][]'s [DateTimeFormat][] and [NumberFormat][].

```js
var rf = new IntlRelativeFormat(locales, [options]);
```

The `locales` can either be a single language tag, e.g., `"en-US"` or an array of them from which the first match will be used. `options` provides a way to control the output of the formatted relative time string.

```js
var output = rf.format(someDate, [options]);
```

### Common Usage Example

The most common way to use this library is to construct an `IntlRelativeFormat` instance and reuse it many times for formatting different date values; e.g.:

```js
var rf = new IntlRelativeFormat('en-US');

var posts = [
    {
        id   : 1,
        title: 'Some Blog Post',
        date : new Date(1426271670524)
    },
    {
        id   : 2,
        title: 'Another Blog Post',
        date : new Date(1426278870524)
    }
];

posts.forEach(function (post) {
    console.log(rf.format(post.date));
});
// => "3 hours ago"
// => "1 hour ago"
```

### Features

* Uses industry standards [CLDR locale data][CLDR].

* Style options for `"best fit"` ("yesterday") and `"numeric"` ("1 day ago") output.

* Units options for always rendering in a particular unit; e.g. "30 days ago", instead of "1 month ago".

* Ability to specify the "now" value from which the relative time is calculated, allowing `format()`.

*  Formats numbers in relative time strings using [`Intl.NumberFormat`][NumberFormat].

* Optimized for repeated calls to an `IntlRelativeFormat` instance's `format()` method.


Usage
-----

### `Intl` Dependency

This package assumes that the [`Intl`][Intl] global object exists in the runtime. `Intl` is present in all modern browsers _except_ Safari, and there's work happening to [integrate `Intl` into Node.js][Intl-Node].

**Luckly, there's the [Intl.js][] polyfill!** You will need to conditionally load the polyfill if you want to support runtimes which `Intl` is not already built-in.

### Loading IntlRelativeFormat in Node.js

Install package and polyfill:

```bash
npm install intl-relativeformat --save
npm install intl --save
```

Simply `require()` this package:

```js
if (!global.Intl) {
    global.Intl = require('intl'); // polyfill for `Intl`
}
var IntlRelativeFormat = require('intl-relativeformat');
var rf = new IntlRelativeFormat('en');
var output = rf.format(dateValue);
```

_Note: in Node.js, the data for all 200+ languages is loaded along with the library._

### Loading IntlRelativeFormat in a browser

If the browser does not already have the `Intl` APIs built-in, the Intl.js Polyfill will need to be loaded on the page along with the locale data for any locales that need to be supported:

```html
<script src="intl/Intl.min.js"></script>
<script src="intl/locale-data/jsonp/en-US.js"></script>
```

_Note: Modern browsers already have the `Intl` APIs built-in, so you can load the Intl.js Polyfill conditionally, by for checking for `window.Intl`._

Include the library in your page:

```html
<script src="intl-relativeformat/dist/intl-relativeformat.min.js"></script>
```

By default, Intl RelativeFormat ships with the locale data for English (`en`) built-in to the runtime library. When you need to format data in another locale, include its data; e.g., for French:

```html
<script src="intl-relativeformat/dist/locale-data/fr.js"></script>
```

_Note: All 200+ languages supported by this package use their root BCP 47 language tag; i.e., the part before the first hyphen (if any)._

### Bundling IntlRelativeFormat with Browserify/Webpack

Install package:

```bash
npm install intl-relativeformat --save
```

Simply `require()` this package and the specific locales you wish to support in the bundle:

```js
var IntlRelativeFormat = require('intl-relativeformat');
require('intl-relativeformat/dist/locale-data/en.js');
require('intl-relativeformat/dist/locale-data/fr.js');
```

_Note: in Node.js, the data for all 200+ languages is loaded along with the library, but when bundling it with Browserify/Webpack, the data is intentionally ignored (see `package.json` for more details) to avoid blowing up the size of the bundle with data that you might not need._

### Public API

#### `IntlRelativeFormat` Constructor

To format a date to relative time, use the `IntlRelativeFormat` constructor. The constructor takes two parameters:

 - **locales** - _{String | String[]}_ - A string with a BCP 47 language tag, or an array of such strings. If you do not provide a locale, the default locale will be used. When an array of locales is provided, each item and its ancestor locales are checked and the first one with registered locale data is returned. **See: [Locale Resolution](#locale-resolution) for more details.**

 - **[options]** - _{Object}_ - Optional object with user defined options for format styles.
 **See: [Custom Options](#custom-options) for more details.**

_Note: The `rf` instance should be enough for your entire application, unless you want to use custom options._

#### Locale Resolution

`IntlRelativeFormat` uses a locale resolution process similar to that of the built-in `Intl` APIs to determine which locale data to use based on the `locales` value passed to the constructor. The result of this resolution process can be determined by call the `resolvedOptions()` prototype method.

The following are the abstract steps `IntlRelativeFormat` goes through to resolve the locale value:

* If no extra locale data is loaded, the locale will _always_ resolved to `"en"`.

* If locale data is missing for a leaf locale like `"fr-FR"`, but there _is_ data for one of its ancestors, `"fr"` in this case, then its ancestor will be used.

* If there's data for the specified locale, then that locale will be resolved; i.e.,

    ```js
    var rf = new IntlRelativeFormat('en-US');
    assert(rf.resolvedOptions().locale === 'en-US'); // true
    ```

* The resolved locales are now normalized; e.g., `"en-us"` will resolve to: `"en-US"`.

_Note: When an array is provided for `locales`, the above steps happen for each item in that array until a match is found._

#### Custom Options

The optional second argument `options` provides a way to customize how the relative time will be formatted.

##### Units

By default, the relative time is computed to the best fit unit, but you can explicitly call it to force `units` to be displayed in `"second"`, `"minute"`, `"hour"`, `"day"`, `"month"` or `"year"`:

```js
var rf = new IntlRelativeFormat('en', {
    units: 'day'
});
var output = rf.format(dateValue);
```

As a result, the output will be "70 days ago" instead of "2 months ago".

##### Style

By default, the relative time is computed as `"best fit"`, which means that instead of "1 day ago", it will display "yesterday", or "in 1 year" will be "next year", etc. But you can force to always use the "numeric" alternative:

```js
var rf = new IntlRelativeFormat('en', {
    style: 'numeric'
});
var output = rf.format(dateValue);
```

As a result, the output will be "1 day ago" instead of "yesterday".

#### `resolvedOptions()` Method

This method returns an object with the options values that were resolved during instance creation. It currently only contains a `locale` property; here's an example:

```js
var rf = new IntlRelativeFormat('en-us');
console.log(rf.resolvedOptions().locale); // => "en-US"
```

Notice how the specified locale was the all lower-case value: `"en-us"`, but it was resolved and normalized to: `"en-US"`.

#### `format(date, [options])` Method

The format method (_which takes a JavaScript date or timestamp_) and optional `options` arguments will compare the `date` with "now" (or `options.now`), and returns the formatted string; e.g., "3 hours ago" in the corresponding locale passed into the constructor.

```js
var output = rf.format(new Date());
console.log(output); // => "now"
```

If you wish to specify a "now" value, it can be provided via `options.now` and will be used instead of querying `Date.now()` to get the current "now" value.


License
-------

This software is free to use under the Yahoo! Inc. BSD license.
See the [LICENSE file][LICENSE] for license text and copyright information.


[npm]: https://www.npmjs.org/package/intl-relativeformat
[npm-badge]: https://img.shields.io/npm/v/intl-relativeformat.svg?style=flat-square
[david]: https://david-dm.org/yahoo/intl-relativeformat
[david-badge]: https://img.shields.io/david/yahoo/intl-relativeformat.svg?style=flat-square
[travis]: https://travis-ci.org/yahoo/intl-relativeformat
[travis-badge]: https://img.shields.io/travis/yahoo/intl-relativeformat/master.svg?style=flat-square
[parser]: https://github.com/yahoo/intl-relativeformat-parser
[CLDR]: http://cldr.unicode.org/
[Intl]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
[Intl-NF]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NumberFormat
[Intl-DTF]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
[Intl-Node]: https://github.com/joyent/node/issues/6371
[Intl.js]: https://github.com/andyearnshaw/Intl.js
[rawgit]: https://rawgit.com/
[semver]: http://semver.org/
[LICENSE]: https://github.com/yahoo/intl-relativeformat/blob/master/LICENSE
[moment.js]: http://momentjs.com/
[sauce]: https://saucelabs.com/u/intl-relativeformat
[sauce-badge]: https://saucelabs.com/browser-matrix/intl-relativeformat.svg
[ECMA 402]: http://www.ecma-international.org/ecma-402/1.0/index.html
[DateTimeFormat]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
[NumberFormat]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NumberFormat
