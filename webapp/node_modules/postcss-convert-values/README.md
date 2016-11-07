# [postcss][postcss]-convert-values [![Build Status](https://travis-ci.org/ben-eb/postcss-convert-values.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-convert-values.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-convert-values.svg)][deps]

> Convert values with PostCSS (e.g. ms -> s)

## Install

With [npm](https://npmjs.org/package/postcss-convert-values) do:

```
npm install postcss-convert-values --save
```

## Example

This plugin reduces CSS size by converting values to use different units
where possible; for example, `500ms` can be represented as `.5s`. You can
read more about these units in [this article][csstricks].

### Input

```css
h1 {
    font-size: 16px;
    width: 0em
}
```

### Output

```css
h1 {
    font-size: 1pc;
    width: 0
}
```

Note that this plugin only covers conversions for duration and absolute length
values. For color conversions, use [postcss-colormin][colormin].

## API

### convertValues([options])

#### options

##### length

Type: `boolean`
Default: `true`

Pass `false` to disable conversion from `px` to other absolute length units,
such as `pc` & `pt` & vice versa.

##### time

Type: `boolean`
Default: `true`

Pass `false` to disable conversion from `ms` to `s` & vice versa.

##### angle

Type: `boolean`
Default: `true`

Pass `false` to disable conversion from `deg` to `turn` & vice versa.

##### precision

Type: `boolean|number`
Default: `false`

Specify any numeric value here to round `px` values to that many decimal places;
for example, using `{precision: 2}` will round `6.66667px` to `6.67px`, and
`{precision: 0}` will round it to `7px`. Passing `false` (the default) will
leave these values as is.

It is recommended for most use cases to set this option to `2`.


## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars.githubusercontent.com/u/1282980?v=3" width="100px;"/><br /><sub>Ben Briggs</sub>](http://beneb.info)<br />[💻](https://github.com/ben-eb/postcss-convert-values/commits?author=ben-eb) [📖](https://github.com/ben-eb/postcss-convert-values/commits?author=ben-eb) 👀 [⚠️](https://github.com/ben-eb/postcss-convert-values/commits?author=ben-eb) | [<img src="https://avatars.githubusercontent.com/u/5635476?v=3" width="100px;"/><br /><sub>Bogdan Chadkin</sub>](https://github.com/TrySound)<br />[💻](https://github.com/ben-eb/postcss-convert-values/commits?author=TrySound) [📖](https://github.com/ben-eb/postcss-convert-values/commits?author=TrySound) 👀 [⚠️](https://github.com/ben-eb/postcss-convert-values/commits?author=TrySound) | [<img src="https://avatars.githubusercontent.com/u/177485?v=3" width="100px;"/><br /><sub>Roman Komarov</sub>](http://kizu.ru/en/)<br />[🐛](https://github.com/ben-eb/postcss-convert-values/issues?q=author%3Akizu) | [<img src="https://avatars.githubusercontent.com/u/5103477?v=3" width="100px;"/><br /><sub>Dmitry Kiselyov</sub>](http://codepen.io/dmitrykiselyov)<br />[🐛](https://github.com/ben-eb/postcss-convert-values/issues?q=author%3Admitrykiselyov) | [<img src="https://avatars.githubusercontent.com/u/5038030?v=3" width="100px;"/><br /><sub>Charlike Mike Reagent</sub>](http://www.tunnckocore.tk)<br />[💻](https://github.com/ben-eb/postcss-convert-values/commits?author=tunnckoCore) [⚠️](https://github.com/ben-eb/postcss-convert-values/commits?author=tunnckoCore) | [<img src="https://avatars.githubusercontent.com/u/815848?v=3" width="100px;"/><br /><sub>Vyacheslav Shebanov</sub>](https://github.com/Termina1)<br />[📖](https://github.com/ben-eb/postcss-convert-values/commits?author=Termina1) | [<img src="https://avatars.githubusercontent.com/u/192323?v=3" width="100px;"/><br /><sub>Marek ‘saji’ Augustynowicz</sub>](http://twitter.com/saji_)<br />[💻](https://github.com/ben-eb/postcss-convert-values/commits?author=marek-saji) [⚠️](https://github.com/ben-eb/postcss-convert-values/commits?author=marek-saji) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [<img src="https://avatars.githubusercontent.com/u/552316?v=3" width="100px;"/><br /><sub>Jonny Gerig Meyer</sub>](www.oddbird.net)<br />[💻](https://github.com/ben-eb/postcss-convert-values/commits?author=jgerigmeyer) [⚠️](https://github.com/ben-eb/postcss-convert-values/commits?author=jgerigmeyer) |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors] specification. Contributions of
any kind welcome!

## License

MIT © [Ben Briggs](http://beneb.info)


[all-contributors]: https://github.com/kentcdodds/all-contributors
[ci]:       https://travis-ci.org/ben-eb/postcss-convert-values
[colormin]: https://github.com/ben-eb/postcss-colormin
[deps]:     https://gemnasium.com/ben-eb/postcss-convert-values
[npm]:      http://badge.fury.io/js/postcss-convert-values
[postcss]:  https://github.com/postcss/postcss

[csstricks]: https://css-tricks.com/the-lengths-of-css/
