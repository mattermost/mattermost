# Intl.js [![Build Status][]](https://travis-ci.org/andyearnshaw/Intl.js)

In December 2012, ECMA International published the first edition of Standard ECMA-402,
better known as the _ECMAScript Internationalization API_. This specification provides
the framework to bring long overdue localization methods to ECMAScript implementations.

All modern browsers, except safari, have implemented this API. `Intl.js` fills the void of availability for this API. It will provide the framework as described by the specification, so that developers can take advantage of the native API
in environments that support it, or `Intl.js` for legacy or unsupported environments.

[Build Status]: https://travis-ci.org/andyearnshaw/Intl.js.svg?branch=master


## Getting started

### Intl.js and FT Polyfill Service

Intl.js polyfill was recently added to the [Polyfill service][], which is developed and maintained by a community of contributors led by a team at the [Financial Times](http://www.ft.com/). It is available through `cdn.polyfill.io` domain, which routes traffic through [Fastly](http://www.fastly.com/), which makes it available with global high availability and superb performance no matter where your users are.

To use the Intl polyfill through the [Polyfill service][] just add one script tag in your page before you load or parse your own JavaScript:

```
<script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=Intl.~locale.en"></script>
```

When specifying the `features` to use through the polyfill service, you have to specify what locale, or locales to load along with the Intl polyfill for the page to function, in the example above we are specifying `Intl.~locale.en`, which means only `en`, but you could do something like this:

```
<script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=Intl.~locale.fr,Intl.~locale.pt"></script>
```

_note: the example above will load the polyfill with two locale data set, `fr` and `pt`._

This is by far the best option to use the Intl polyfill since it will only load the polyfill code and the corresponding locale data when it is really needed (e.g.: safari will get the code and patch the runtime while chrome will get an empty script tag).

[Polyfill service]: https://cdn.polyfill.io/v1/docs/

### Intl.js and Node

For Node.js applications, you can install `intl` using NPM:

    npm install intl

Node.js 0.12 has the Intl APIs built-in, but only includes the English locale data by default. If your app needs to support more locales than English, you'll need to [get Node to load the extra locale data](https://github.com/nodejs/node/wiki/Intl), or use `intl` npm package to patch the runtime with the Intl polyfill. Node.js versions prior to 0.12 and ≥v3.1 don't provide the Intl APIs, so they require that the runtime is polyfilled.

The following code snippet uses the intl polyfill and [intl-locales-supported](https://github.com/yahoo/intl-locales-supported) npm packages which will help you polyfill the Node.js runtime when the Intl APIs are missing, or if the built-in Intl is missing locale data that's needed for your app:

```javascript
var areIntlLocalesSupported = require('intl-locales-supported');

var localesMyAppSupports = [
    /* list locales here */
];

if (global.Intl) {
    // Determine if the built-in `Intl` has the locale data we need.
    if (!areIntlLocalesSupported(localesMyAppSupports)) {
        // `Intl` exists, but it doesn't have the data we need, so load the
        // polyfill and patch the constructors we need with the polyfill's.
        var IntlPolyfill    = require('intl');
        Intl.NumberFormat   = IntlPolyfill.NumberFormat;
        Intl.DateTimeFormat = IntlPolyfill.DateTimeFormat;
    }
} else {
    // No `Intl`, so use and load the polyfill.
    global.Intl = require('intl');
}
```

### Intl.js and Browserify/webpack

If you build your application using [browserify][] or [webpack][], you will install `intl` npm package as a dependency of your application. Ideally, you will avoid loading this library if the browser supports the
built-in `Intl`. An example of conditional usage using [webpack][] _might_ look like this:

```javascript
function runMyApp() {
    var nf = new Intl.NumberFormat(undefined, {style:'currency', currency:'GBP'});
    document.getElementById('price').textContent = nf.format(100);
}
if (!global.Intl) {
    require.ensure([
        'intl',
        'intl/locale-data/jsonp/en.js'
    ], function (require) {
        require('intl');
        require('intl/locale-data/jsonp/en.js');
        runMyApp()
    });
} else {
    runMyApp()
}
```

_note: a similar approach can be implemented with [browserify][], althought it does not support `require.ensure`._

_note: the locale data is required for the polyfill to function when using it in a browser environment, in the example above, the english (`en`) locale is being required along with the polyfill itself._

[webpack]: https://webpack.github.io/
[browserify]: http://browserify.org/

### Intl.js and Bower

Intl.js is also available as a [Bower](http://bower.io) component for the front-end:

    bower install intl

Then include the polyfill in your pages as described below:

```html
<script src="path/to/intl/Intl.js"></script>
<script src="path/to/intl/locale-data/jsonp/en.js"></script>
```

_note: use the locale for the current user, instead of hard-coding to `en`._

## Status
Current progress is as follows:

### Implemented
 - All internal methods except for some that are implementation dependent
 - Checking structural validity of language tags  
 - Canonicalizing the case and order of language subtags
 - __`Intl.NumberFormat`__
   - The `Intl.NumberFormat` constructor ([11.1](http://www.ecma-international.org/ecma-402/1.0/#sec-11.1))
   - Properties of the `Intl.NumberFormat` Constructor ([11.2](http://www.ecma-international.org/ecma-402/1.0/#sec-11.2))
   - Properties of the `Intl.NumberFormat` Prototype Object ([11.3](http://www.ecma-international.org/ecma-402/1.0/#sec-11.3))
   - Properties of Intl.NumberFormat Instances([11.4](http://www.ecma-international.org/ecma-402/1.0/#sec-11.4))
 - __`Intl.DateTimeFormat`__
   - The `Intl.DateTimeFormat` constructor ([12.1](http://www.ecma-international.org/ecma-402/1.0/#sec-12.1))
   - Properties of the `Intl.DateTimeFormat` Constructor ([12.2](http://www.ecma-international.org/ecma-402/1.0/#sec-12.2))
   - Properties of the `Intl.DateTimeFormat` Prototype Object ([12.3](http://www.ecma-international.org/ecma-402/1.0/#sec-12.3))
   - Properties of Intl.DateTimeFormat Instances([12.4](http://www.ecma-international.org/ecma-402/1.0/#sec-12.4))
 - Locale Sensitive Functions of the ECMAScript Language Specification
   - Properties of the `Number` Prototype Object ([13.2](http://www.ecma-international.org/ecma-402/1.0/#sec-13.2))
   - Properties of the `Date` prototype object ([13.3](http://www.ecma-international.org/ecma-402/1.0/#sec-13.3))

### Not Implemented
 - `BestFitSupportedLocales` internal function
 - Implementation-dependent numbering system mappings
 - Calendars other than Gregorian
 - Support for time zones
 - Collator objects (`Intl.Collator`) (see below)
 - Properties of the `String` prototype object

A few of the implemented functions may currently be non-conforming and/or incomplete.  
Most of those functions have comments marked as 'TODO' in the source code.

The test suite is run with Intl.Collator tests removed, and the Collator
constructor removed from most other tests in the suite.  Also some parts of
tests that cannot be passed by a JavaScript implementation have been disabled,
as well as a small part of the same tests that fail due to [this bug in v8][].

 [this bug in v8]: https://code.google.com/p/v8/issues/detail?id=2694


## What about Intl.Collator?

Providing an `Intl.Collator` implementation is no longer a goal of this project. There
are several reasons, including:

 - The CLDR convertor does not automatically convert collation data to JSON
 - The Unicode Collation Algorithm is more complicated that originally anticipated,
   and would increase the code size of Intl.js too much.
 - The Default Unicode Collation Element Table is huge, even after compression, and
   converting to a native JavaScript object would probably make it slightly larger.
   Server-side JavaScript environments will (hopefully) soon support Intl.Collator,
   and we can't really expect client environments to download this data.


## Compatibility
Intl.js is designed to be compatible with ECMAScript 3.1 environments in order to
follow the specification as closely as possible. However, some consideration is given
to legacy (ES3) environments, and the goal of this project is to at least provide a
working, albeit non-compliant implementation where ES5 methods are unavailable.

A subset of the tests in the test suite are run in IE 8.  Tests that are not passable
are skipped, but these tests are mostly about ensuring built-in function behavior.


## Locale Data
`Intl.js` uses the Unicode CLDR locale data, as recommended by the specification. The main `Intl.js` file contains no locale data itself. In browser environments, the
data should be provided, passed into a JavaScript object using the
`Intl.__addLocaleData()` method.  In Node.js, or when using `require('intl')`, the data
is automatically added to the runtime and does not need to be provided.

Contents of the `locale-data` directory are a modified form of the Unicode CLDR
data found at http://www.unicode.org/cldr/.

## RegExp cache / restore
`Intl.js` attempts to cache and restore static RegExp properties before executing any
regular expressions in order to comply with ECMA-402.  This process is imperfect,
and some situations are not supported.  This behavior is not strictly necessary, and is only
required if the app depends on RegExp static properties not changing (which is highly
unlikely).  To disable this functionality, invoke `Intl.__disableRegExpRestore()`.

## Contribute

See the [CONTRIBUTING file][] for info.

[CONTRIBUTING file]: https://github.com/andyearnshaw/Intl.js/blob/master/CONTRIBUTING.md


## License

Copyright (c) 2013 Andy Earnshaw

This software is licensed under the MIT license.  See the `LICENSE.txt` file
accompanying this software for terms of use.
