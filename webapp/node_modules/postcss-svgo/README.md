# [postcss][postcss]-svgo [![Build Status](https://travis-ci.org/ben-eb/postcss-svgo.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-svgo.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-svgo.svg)][deps]

> Optimise inline SVG with PostCSS.


## Install

With [npm](https://npmjs.org/package/postcss-svgo) do:

```
npm install postcss-svgo --save
```


## Example

### Input

```css
h1 {
    background: url('data:image/svg+xml;charset=utf-8,<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"><circle cx="50" cy="50" r="40" fill="yellow" /></svg>');
}
```

### Output

```css
h1 {
    background: url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#ff0"/></svg>');
}
```


## API

### `svgo([options])`

Note that postcss-svgo is an *asynchronous* processor. It cannot be used
like this:

```js
var result = postcss([ svgo() ]).process(css).css;
console.log(result);
```

Instead make sure your PostCSS runner uses the asynchronous API:

```js
postcss([ svgo() ]).process(css).then(function (result) {
    console.log(result.css);
});
```

#### options

##### encode

Type: `boolean`
Default: `undefined`

If `true`, it will encode URL-unsafe characters such as `<`, `>` and `#`;
`false` will decode these characters, and `undefined` will neither encode nor
decode the original input.

##### plugins

Optionally, you can customise the output by specifying the `plugins` option. You
will need to provide the config in comma separated objects, like the example
below. Note that you can either disable the plugin by setting it to `false`,
or pass different options to change the default behaviour.

```js
var postcss = require('postcss');
var svgo = require('postcss-svgo');

var opts = {
    plugins: [{
        removeDoctype: false
    }, {
        removeComments: false
    }, {
        cleanupNumericValues: {
            floatPrecision: 2
        }
    }, {
        convertColors: {
            names2hex: false,
            rgb2hex: false
        }
    }]
};

postcss([ svgo(opts) ]).process(css).then(function (result) {
    console.log(result.css)
});
```

You can view the [full list of plugins here][plugins].


## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.


## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars.githubusercontent.com/u/1282980?v=3" width="100px;"/><br /><sub>Ben Briggs</sub>](http://beneb.info)<br />[💻](https://github.com/ben-eb/postcss-svgo/commits?author=ben-eb) [📖](https://github.com/ben-eb/postcss-svgo/commits?author=ben-eb) 👀 [⚠️](https://github.com/ben-eb/postcss-svgo/commits?author=ben-eb) | [<img src="https://avatars.githubusercontent.com/u/7263665?v=3" width="100px;"/><br /><sub>Sebastian Misch</sub>](https://sebastian-misch.de)<br />[💻](https://github.com/ben-eb/postcss-svgo/commits?author=sbstnmsch) [⚠️](https://github.com/ben-eb/postcss-svgo/commits?author=sbstnmsch) | [<img src="https://avatars.githubusercontent.com/u/11319202?v=3" width="100px;"/><br /><sub>Вячеслав Ляшенко</sub>](https://github.com/ophyros)<br />[💻](https://github.com/ben-eb/postcss-svgo/commits?author=ophyros) [⚠️](https://github.com/ben-eb/postcss-svgo/commits?author=ophyros) | [<img src="https://avatars.githubusercontent.com/u/1131567?v=3" width="100px;"/><br /><sub>shinnn</sub>](https://shinnn.github.io)<br />[💻](https://github.com/ben-eb/postcss-svgo/commits?author=shinnn) | [<img src="https://avatars.githubusercontent.com/u/45338?v=3" width="100px;"/><br /><sub>Jung-gun Lim</sub>](https://github.com/j6lim)<br />[🐛](https://github.com/ben-eb/postcss-svgo/issues?q=author%3Aj6lim) | [<img src="https://avatars.githubusercontent.com/u/5635476?v=3" width="100px;"/><br /><sub>Bogdan Chadkin</sub>](https://github.com/TrySound)<br />[💻](https://github.com/ben-eb/postcss-svgo/commits?author=TrySound) 👀 [⚠️](https://github.com/ben-eb/postcss-svgo/commits?author=TrySound) | [<img src="https://avatars.githubusercontent.com/u/368561?v=3" width="100px;"/><br /><sub>Piotr Walczyszyn</sub>](http://outof.me)<br />[🐛](https://github.com/ben-eb/postcss-svgo/issues?q=author%3Apwalczyszyn) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors] specification. Contributions of
any kind welcome!

## License

MIT © [Ben Briggs](http://beneb.info)


[all-contributors]: https://github.com/kentcdodds/all-contributors
[ci]:      https://travis-ci.org/ben-eb/postcss-svgo
[deps]:    https://gemnasium.com/ben-eb/postcss-svgo
[npm]:     http://badge.fury.io/js/postcss-svgo
[postcss]: https://github.com/postcss/postcss
[plugins]: https://github.com/svg/svgo/tree/master/plugins
