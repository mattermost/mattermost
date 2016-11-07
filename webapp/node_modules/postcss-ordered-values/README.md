# [postcss][postcss]-ordered-values [![Build Status](https://travis-ci.org/ben-eb/postcss-ordered-values.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-ordered-values.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-ordered-values.svg)][deps]

> Ensure values are ordered consistently in your CSS.


## Install

With [npm](https://npmjs.org/package/postcss-ordered-values) do:

```
npm install postcss-ordered-values --save
```


## Example

Some CSS properties accept their values in an arbitrary order; for this reason,
it is entirely possible that different developers will write their values in
different orders. This module normalizes the order, making it easier for other
modules to understand which declarations are duplicates.

### Input

```css
h1 {
    border: solid 1px red;
    border: red solid .5em;
    border: rgba(0, 30, 105, 0.8) solid 1px;
    border: 1px solid red;
}
```

### Output

```css
h1 {
    border: 1px solid red;
    border: .5em solid red;
    border: 1px solid rgba(0, 30, 105, 0.8);
    border: 1px solid red;
}
```


## Support List

For more examples, see the [tests](src/__tests__/index.js).

* `border(border-left|right|top|bottom)`
* `box-shadow`
* `outline`
* `flex-flow`
* `transition`, `-webkit-transition`


## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.


## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars.githubusercontent.com/u/1282980?v=3" width="100px;"/><br /><sub>Ben Briggs</sub>](http://beneb.info)<br />[💻](https://github.com/ben-eb/postcss-ordered-values/commits?author=ben-eb) [📖](https://github.com/ben-eb/postcss-ordered-values/commits?author=ben-eb) 👀 [⚠️](https://github.com/ben-eb/postcss-ordered-values/commits?author=ben-eb) | [<img src="https://avatars.githubusercontent.com/u/2784308?v=3" width="100px;"/><br /><sub>一丝</sub>](www.iyunlu.com/view)<br />[💻](https://github.com/ben-eb/postcss-ordered-values/commits?author=yisibl) [⚠️](https://github.com/ben-eb/postcss-ordered-values/commits?author=yisibl) | [<img src="https://avatars.githubusercontent.com/u/5635476?v=3" width="100px;"/><br /><sub>Bogdan Chadkin</sub>](https://github.com/TrySound)<br />[💻](https://github.com/ben-eb/postcss-ordered-values/commits?author=TrySound) [⚠️](https://github.com/ben-eb/postcss-ordered-values/commits?author=TrySound) | [<img src="https://avatars.githubusercontent.com/u/497260?v=3" width="100px;"/><br /><sub>Ambroos Vaes</sub>](https://github.com/Ambroos)<br />[🐛](https://github.com/ben-eb/postcss-ordered-values/issues?q=author%3AAmbroos) |
| :---: | :---: | :---: | :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors] specification. Contributions of
any kind welcome!


## License

MIT © [Ben Briggs](http://beneb.info)


[all-contributors]: https://github.com/kentcdodds/all-contributors
[ci]:      https://travis-ci.org/ben-eb/postcss-ordered-values
[deps]:    https://gemnasium.com/ben-eb/postcss-ordered-values
[npm]:     http://badge.fury.io/js/postcss-ordered-values
[postcss]: https://github.com/postcss/postcss
