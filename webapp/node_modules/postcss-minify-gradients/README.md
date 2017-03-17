# [postcss][postcss]-minify-gradients [![Build Status](https://travis-ci.org/ben-eb/postcss-minify-gradients.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-minify-gradients.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-minify-gradients.svg)][deps]

> Minify gradient parameters with PostCSS.

## Install

With [npm](https://npmjs.org/package/postcss-minify-gradients) do:

```
npm install postcss-minify-gradients
```


## Example

Where possible, this module will minify gradient parameters. It can convert
linear gradient directional syntax to angles, remove the unnecessary `0%` and
`100%` start and end values, and minimise color stops that use the same length
values (the browser will adjust the value automatically).

### Input

```css
h1 {
    background: linear-gradient(to bottom, #ffe500 0%, #ffe500 50%, #121 50%, #121 100%)
}
```

### Output

```css
h1 {
    background: linear-gradient(180deg, #ffe500, #ffe500 50%, #121 0, #121)
}
```


## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.


## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars.githubusercontent.com/u/1282980?v=3" width="100px;"/><br /><sub>Ben Briggs</sub>](http://beneb.info)<br />[💻](https://github.com/ben-eb/postcss-minify-gradients/commits?author=ben-eb) [📖](https://github.com/ben-eb/postcss-minify-gradients/commits?author=ben-eb) 👀 [⚠️](https://github.com/ben-eb/postcss-minify-gradients/commits?author=ben-eb) | [<img src="https://avatars.githubusercontent.com/u/5635476?v=3" width="100px;"/><br /><sub>Bogdan Chadkin</sub>](https://github.com/TrySound)<br />[💻](https://github.com/ben-eb/postcss-minify-gradients/commits?author=TrySound) | [<img src="https://avatars.githubusercontent.com/u/1448788?v=3" width="100px;"/><br /><sub></sub>](https://github.com/huan086)<br />[🐛](https://github.com/ben-eb/postcss-minify-gradients/issues?q=author%3Ahuan086) | [<img src="https://avatars.githubusercontent.com/u/2485494?v=3" width="100px;"/><br /><sub>Mikhail</sub>](https://github.com/jaybekster)<br />[🐛](https://github.com/ben-eb/postcss-minify-gradients/issues?q=author%3Ajaybekster) [💻](https://github.com/ben-eb/postcss-minify-gradients/commits?author=jaybekster) [⚠️](https://github.com/ben-eb/postcss-minify-gradients/commits?author=jaybekster) |
| :---: | :---: | :---: | :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors] specification. Contributions of
any kind welcome!


## License

MIT © [Ben Briggs](http://beneb.info)


[all-contributors]: https://github.com/kentcdodds/all-contributors
[ci]:      https://travis-ci.org/ben-eb/postcss-minify-gradients
[deps]:    https://gemnasium.com/ben-eb/postcss-minify-gradients
[npm]:     http://badge.fury.io/js/postcss-minify-gradients
[postcss]: https://github.com/postcss/postcss
