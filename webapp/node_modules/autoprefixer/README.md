# Autoprefixer [![Build Status][ci-img]][ci]

<img align="right" width="94" height="71"
     src="http://postcss.github.io/autoprefixer/logo.svg"
     title="Autoprefixer logo by Anton Lovchikov">

[PostCSS] plugin to parse CSS and add vendor prefixes to CSS rules using values
from [Can I Use]. It is [recommended] by Google and used in Twitter,
and Taobao.

Write your CSS rules without vendor prefixes (in fact, forget about them
entirely):

```css
:fullscreen a {
    display: flex
}
```

Autoprefixer will use the data based on current browser popularity and property
support to apply prefixes for you. You can try the [interactive demo]
of Autoprefixer.

```css
:-webkit-full-screen a {
    display: -webkit-box;
    display: flex
}
:-moz-full-screen a {
    display: flex
}
:-ms-fullscreen a {
    display: -ms-flexbox;
    display: flex
}
:fullscreen a {
    display: -webkit-box;
    display: -ms-flexbox;
    display: flex
}
```

Twitter account for news and releases: [@autoprefixer].

<a href="https://evilmartians.com/?utm_source=autoprefixer">
<img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg" alt="Sponsored by Evil Martians" width="236" height="54">
</a>

[interactive demo]: http://autoprefixer.github.io/
[@autoprefixer]:    https://twitter.com/autoprefixer
[recommended]:      https://developers.google.com/web/tools/setup/setup-buildtools#dont-trip-up-with-vendor-prefixes
[Can I Use]:        http://caniuse.com/
[PostCSS]:          https://github.com/postcss/postcss
[ci-img]:           https://travis-ci.org/postcss/autoprefixer.svg
[ci]:               https://travis-ci.org/postcss/autoprefixer

## Features

### Write Pure CSS

Working with Autoprefixer is simple: just forget about vendor prefixes
and write normal CSS according to the latest W3C specs. You don’t need
a special language (like Sass) or remember where you must use mixins.

Autoprefixer supports selectors (like `:fullscreen` and `::selection`),
unit function (`calc()`), at‑rules (`@supports` and `@keyframes`)
and properties.

Because Autoprefixer is a postprocessor for CSS,
you can also use it with preprocessors such as Sass, Stylus or LESS.

### Flexbox, Filters, etc.

Just write normal CSS according to the latest W3C specs and Autoprefixer
will produce the code for old browsers.

```css
a {
    display: flex;
}
```

compiles to:

```css
a {
    display: -webkit-box;
    display: -webkit-flex;
    display: -ms-flexbox;
    display: flex
}
```

Autoprefixer has [27 special hacks] to fix web browser differences.

[27 special hacks]: https://github.com/postcss/autoprefixer/tree/master/lib/hacks

### Only Actual Prefixes

Autoprefixer utilizes the most recent data from [Can I Use]
to add only necessary vendor prefixes.

It also removes old, unnecessary prefixes from your CSS
(like `border-radius` prefixes, produced by many CSS libraries).

```css
a {
    -webkit-border-radius: 5px;
            border-radius: 5px;
}
```

compiles to:

```css
a {
    border-radius: 5px;
}
```

[Can I Use]: http://caniuse.com/

## Browsers

Autoprefixer uses [Browserslist], so you can specify the browsers
you want to target in your project by queries like `last 2 versions`
or `> 5%`.

If you don’t provide the browsers option, Browserslist will try
to find the `browserslist` config in parent dirs.

See [Browserslist docs] for queries, browser names, config format,
and default value.

[Browserslist]:      https://github.com/ai/browserslist
[Browserslist docs]: https://github.com/ai/browserslist#queries

## Outdated Prefixes

By default, Autoprefixer also removes outdated prefixes.

You can disable this behavior with the `remove: false` option. If you have
no legacy code, this option will make Autoprefixer about 10% faster.

Also, you can set the `add: false` option. Autoprefixer will only clean outdated
prefixes, but will not add any new prefixes.

Autoprefixer adds new prefixes between any unprefixed properties and already
written prefixes in your CSS. If it will break the expected prefixes order,
you can clean all prefixes from your CSS and then
add the necessary prefixes again:

```js
var cleaner  = postcss([ autoprefixer({ add: false, browsers: [] }) ]);
var prefixer = postcss([ autoprefixer ]);

cleaner.process(css).then(function (cleaned) {
    return prefixer.process(cleaned.css)
}).then(function (result) {
    console.log(result.css);
});
```

## FAQ

#### No prefixes in production

Many other tools contain Autoprefixer. For example, webpack uses Autoprefixer
to minify CSS by cleaning unnecessary prefixes.

If you set browsers list to Autoprefixer by `browsers` option, only first
Autoprefixer will know your browsers. Autoprefixer inside webpack will use
default browsers list. As result, webpack will remove prefixes, that first
Autoprefixer added.

You need to put your browsers to [`browserslist` config] in project root —
as result all tools (Autoprefixer, cssnano, doiuse, cssnext) will use same
browsers list.

[`browserslist` config]: https://github.com/ai/browserslist#config-file

#### Does it add polyfills?

No. Autoprefixer only adds prefixes.

Most new CSS features will require client side JavaScript to handle a new
behavior correctly.

Depending on what you consider to be a “polyfill”, you can take a look at some
other tools and libraries. If you are just looking for syntax sugar,
you might take a look at:

- [Oldie], a PostCSS plugin that handles some IE hacks (opacity, rgba, etc).
- [postcss-flexbugs-fixes], a PostCSS plugin to fix flexbox issues.
- [cssnext], a tool that allows you to write standard CSS syntax non-implemented
  yet in browsers (custom properties, custom media, color functions, etc).

[postcss-flexbugs-fixes]: https://github.com/luisrudge/postcss-flexbugs-fixes
[cssnext]:                https://github.com/MoOx/postcss-cssnext
[Oldie]:                  https://github.com/jonathantneal/oldie

#### Why doesn’t Autoprefixer add prefixes to `border-radius`?

Developers are often surprised by how few prefixes are required today.
If Autoprefixer doesn’t add prefixes to your CSS, check if they’re still
required on [Can I Use].

There is a [list with all supported] properties, values, and selectors.

[list with all supported]: https://github.com/postcss/autoprefixer/wiki/support-list
[Can I Use]:               http://caniuse.com/

#### Why Autoprefixer uses unprefixed properties in `@-webkit-keyframes`?

Browser teams can remove some prefixes before others. So we try to use
all combinations of prefixed/unprefixed values.

#### How to work with legacy `-webkit-` only code?

Autoprefixer needs unprefixed property to add prefixes. So if you only
wrote `-webkit-gradient` without W3C’s `gradient`,
Autoprefixer will not add other prefixes.

But [PostCSS] has a plugins to convert CSS to unprefixed state.
Use them before Autoprefixer:

* [postcss-unprefix]
* [postcss-flexboxfixer]
* [postcss-gradientfixer]

[postcss-gradientfixer]: https://github.com/hallvors/postcss-gradientfixer
[postcss-flexboxfixer]:  https://github.com/hallvors/postcss-flexboxfixer
[postcss-unprefix]:      https://github.com/yisibl/postcss-unprefix

#### Does Autoprefixer add `-epub-` prefix?

No, Autoprefixer works only with browsers prefixes from Can I Use.
But you can use [postcss-epub](https://github.com/Rycochet/postcss-epub)
for prefixing ePub3 properties.

## Usage

### Gulp

In Gulp you can use [gulp-postcss] with `autoprefixer` npm package.

```js
gulp.task('autoprefixer', function () {
    var postcss      = require('gulp-postcss');
    var sourcemaps   = require('gulp-sourcemaps');
    var autoprefixer = require('autoprefixer');

    return gulp.src('./src/*.css')
        .pipe(sourcemaps.init())
        .pipe(postcss([ autoprefixer({ browsers: ['last 2 versions'] }) ]))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('./dest'));
});
```

With `gulp-postcss` you also can combine Autoprefixer
with [other PostCSS plugins].

[other PostCSS plugins]: https://github.com/postcss/postcss#plugins
[gulp-postcss]:          https://github.com/postcss/gulp-postcss

### Webpack

In [webpack] you can use [postcss-loader] with `autoprefixer`
and [other PostCSS plugins].

```js
var autoprefixer = require('autoprefixer');

module.exports = {
    module: {
        loaders: [
            {
                test:   /\.css$/,
                loader: "style-loader!css-loader!postcss-loader"
            }
        ]
    },
    postcss: [ autoprefixer({ browsers: ['last 2 versions'] }) ]
}
```

[other PostCSS plugins]: https://github.com/postcss/postcss#plugins
[postcss-loader]:        https://github.com/postcss/postcss-loader
[webpack]:               http://webpack.github.io/

### Grunt

In Grunt you can use [grunt-postcss] with `autoprefixer` npm package.

```js
module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-postcss');

    grunt.initConfig({
        postcss: {
            options: {
                map: true,
                processors: [
                    require('autoprefixer')({
                        browsers: ['last 2 versions']
                    })
                ]
            },
            dist: {
                src: 'css/*.css'
            }
        }
    });

    grunt.registerTask('default', ['postcss:dist']);
};
```

With `grunt-postcss` you also can combine Autoprefixer
with [other PostCSS plugins].

[other PostCSS plugins]: https://github.com/postcss/postcss#plugins
[grunt-postcss]:         https://github.com/nDmitry/grunt-postcss

### Other Build Tools:

* **Ruby on Rails**: [autoprefixer-rails]
* **Brunch**: [postcss-brunch]
* **Broccoli**: [broccoli-postcss]
* **Middleman**: [middleman-autoprefixer]
* **Mincer**: add `autoprefixer` npm package and enable it:
  `environment.enable('autoprefixer')`
* **Jekyll**: add `autoprefixer-rails` and `jekyll-assets` to `Gemfile`

[middleman-autoprefixer]: https://github.com/middleman/middleman-autoprefixer
[autoprefixer-rails]:     https://github.com/ai/autoprefixer-rails
[broccoli-postcss]:       https://github.com/jeffjewiss/broccoli-postcss
[postcss-brunch]:         https://github.com/iamvdo/postcss-brunch

### Preprocessors

* **Less**: [less-plugin-autoprefix]
* **Stylus**: [autoprefixer-stylus]
* **Compass**: [autoprefixer-rails#compass]

[less-plugin-autoprefix]: https://github.com/less/less-plugin-autoprefix
[autoprefixer-stylus]:    https://github.com/jenius/autoprefixer-stylus
[autoprefixer-rails#compass]:     https://github.com/ai/autoprefixer-rails#compass

### CSS-in-JS

There is [postcss-js] to use Autoprefixer in React Inline Styles, [Free Style],
Radium and other CSS-in-JS solutions.

```js
let prefixer = postcssJs.sync([ autoprefixer ]);
let style = prefixer({
    display: 'flex'
});
```

[postcss-js]: https://github.com/postcss/postcss-js
[Free Style]: https://github.com/blakeembrey/free-style

### GUI Tools

* [CodeKit](https://incident57.com/codekit/help.html#autoprefixer)
* [Prepros](https://prepros.io)

### CLI

You can use the [postcss-cli] to run Autoprefixer from CLI:

```sh
npm install --global postcss-cli autoprefixer
postcss --use autoprefixer *.css -d build/
```

See `postcss -h` for help.

[postcss-cli]: https://github.com/postcss/postcss-cli

### JavaScript

You can use Autoprefixer with [PostCSS] in your Node.js application
or if you want to develop an Autoprefixer plugin for new environment.

```js
var autoprefixer = require('autoprefixer');
var postcss      = require('postcss');

postcss([ autoprefixer ]).process(css).then(function (result) {
    result.warnings().forEach(function (warn) {
        console.warn(warn.toString());
    });
    console.log(result.css);
});
```

There is also [standalone build] for the browser or as a non-Node.js runtime.

You can use [html-autoprefixer] to process HTML with inlined CSS.

[html-autoprefixer]: https://github.com/RebelMail/html-autoprefixer
[standalone build]:  https://raw.github.com/ai/autoprefixer-rails/master/vendor/autoprefixer.js
[PostCSS]:           https://github.com/postcss/postcss

### Text Editors and IDE

Autoprefixer should be used in assets build tools. Text editor plugins are not
a good solution, because prefixes decrease code readability and you will need
to change value in all prefixed properties.

I recommend you to learn how to use build tools like [Gulp].
They work much better and will open you a whole new world of useful plugins
and automatization.

But, if you can’t move to a build tool, you can use text editor plugins:

* [Sublime Text](https://github.com/sindresorhus/sublime-autoprefixer)
* [Brackets](https://github.com/mikaeljorhult/brackets-autoprefixer)
* [Atom Editor](https://github.com/sindresorhus/atom-autoprefixer)
* [Visual Studio](http://vswebessentials.com/)

[Gulp]:  http://gulpjs.com/

## Warnings

Autoprefixer uses the [PostCSS warning API] to warn about really important problems
in your CSS:

* Old direction syntax in gradients.
* Old unprefixed `display: box` instead of `display: flex`
  by latest specification version.

You can get warnings from `result.warnings()`:

```js
result.warnings().forEach(function (warn) {
    console.warn(warn.toString());
});
```

Every Autoprefixer runner should display this warnings.

[PostCSS warning API]: https://github.com/postcss/postcss/blob/master/docs/api.md#warning-class

## Disabling

Autoprefixer was designed to have no interface – it just works.
If you need some browser specific hack just write a prefixed property
after the unprefixed one.

```css
a {
    transform: scale(0.5);
    -moz-transform: scale(0.6);
}
```

If some prefixes were generated in a wrong way,
please create an issue on GitHub.

Autoprefixer has 4 features, which can be disabled by options:

* `supports: false` will disable `@supports` parameters prefixing.
* `flexbox: false` will disable flexbox properties prefixing.
  Or `flexbox: "no-2009"` will add prefixes only for final and IE
  versions of specification.
* `grid: false` will disable Grid Layout prefixes for IE.
* `remove: false` will disable cleaning outdated prefixes.

If you do not need Autoprefixer in some part of your CSS,
you can use control comments to disable Autoprefixer.

```css
a {
    transition: 1s; /* it will be prefixed */
}

b {
    /* autoprefixer: off */
    transition: 1s; /* it will not be prefixed */
}
```

Control comments disable Autoprefixer within the whole rule in which
you place it. In the above example, Autoprefixer will be disabled
in the entire `b` rule scope, not only after the comment.

You can also use comments recursively:

```css
/* autoprefixer: off */
@supports (transition: all) {
    /* autoprefixer: on */
    a {
        /* autoprefixer: off */
    }
}
```

## Options

Function `autoprefixer(options)` returns new PostCSS plugin.
See [PostCSS API] for plugin usage documentation.

```js
var plugin = autoprefixer({ browsers: ['> 1%', 'IE 7'], cascade: false });
```

There are 8 options:

* `browsers` (array): list of browsers, which are supported in your project.
  You can directly specify browser version (like `IE 7`) or use selections
  (like `last 2 version` or `> 5%`). See [Browserslist docs] for available
  queries and default value.
* `cascade` (boolean): should Autoprefixer use Visual Cascade,
  if CSS is uncompressed. Default: `true`
* `add` (boolean): should Autoprefixer add prefixes. Default is `true`.
* `remove` (boolean): should Autoprefixer [remove outdated] prefixes.
  Default is `true`.
* `supports` (boolean): should Autoprefixer add prefixes for `@supports`
  parameters. Default is `true`.
* `flexbox` (boolean|string): should Autoprefixer add prefixes for flexbox
  properties. With `"no-2009"` value Autoprefixer will add prefixes only
  for final and IE versions of specification. Default is `true`.
* `grid` (boolean): should Autoprefixer add IE prefixes for Grid Layout
  properties. Default is `true`.
* `stats` (object): custom [usage statistics] for `> 10% in my stats`
  browsers query.

Plugin object has `info()` method for debugging purpose.

You can use PostCSS processor to process several CSS files
to increase performance.

[usage statistics]: https://github.com/ai/browserslist#custom-usage-data
[PostCSS API]:      https://github.com/postcss/postcss/blob/master/docs/api.md

## Debug

You can check which browsers are selected and which properties will be prefixed:

```js
var info = autoprefixer({ browsers: ['last 1 version'] }).info();
console.log(info);
```
