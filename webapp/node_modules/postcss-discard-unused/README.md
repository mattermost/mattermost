# [postcss][postcss]-discard-unused [![Build Status](https://travis-ci.org/ben-eb/postcss-discard-unused.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-discard-unused.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-discard-unused.svg)][deps]

> Discard unused counter styles, keyframes and fonts.


## Install

With [npm](https://npmjs.org/package/postcss-discard-unused) do:

```
npm install postcss-discard-unused --save
```


## Example

This module will discard unused at rules in your CSS file, if it cannot find
any selectors that make use of them. It works on `@counter-style`, `@keyframes`
and `@font-face`.

### Input

```css
@counter-style custom {
    system: extends decimal;
    suffix: "> "
}

@counter-style custom2 {
    system: extends decimal;
    suffix: "| "
}

a {
    list-style: custom
}
```

### Output

```css
@counter-style custom {
    system: extends decimal;
    suffix: "> "
}

a {
    list-style: custom
}
```

Note that this plugin is not responsible for normalising font families, as it
makes the assumption that you will write your font names consistently, such that
it considers these two declarations differently:

```css
h1 {
    font-family: "Helvetica Neue"
}

h2 {
    font-family: Helvetica Neue
}
```

However, you can mitigate this by including [postcss-minify-font-values][mfv]
*before* this plugin, which will take care of normalising quotes, and
deduplicating. For more examples, see the [tests](test.js).


## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.


## API

### discardUnused([options])

#### options

##### fontFace

Type: `boolean`  
Default: `true`

Pass `false` to disable discarding unused font face rules.

##### counterStyle

Type: `boolean`  
Default: `true`

Pass `false` to disable discarding unused counter style rules.

##### keyframes

Type: `boolean`  
Default: `true`

Pass `false` to disable discarding unused keyframe rules.

##### namespace

Type: `boolean`  
Default: `true`

Pass `false` to disable discarding unused namespace rules.


## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars.githubusercontent.com/u/1282980?v=3" width="100px;"/><br /><sub>Ben Briggs</sub>](http://beneb.info)<br />[💻](https://github.com/ben-eb/postcss-discard-unused/commits?author=ben-eb) [📖](https://github.com/ben-eb/postcss-discard-unused/commits?author=ben-eb) 👀 [⚠️](https://github.com/ben-eb/postcss-discard-unused/commits?author=ben-eb) | [<img src="https://avatars.githubusercontent.com/u/5635476?v=3" width="100px;"/><br /><sub>Bogdan Chadkin</sub>](https://github.com/TrySound)<br />[💻](https://github.com/ben-eb/postcss-discard-unused/commits?author=TrySound) [📖](https://github.com/ben-eb/postcss-discard-unused/commits?author=TrySound) 👀 [⚠️](https://github.com/ben-eb/postcss-discard-unused/commits?author=TrySound) | [<img src="https://avatars.githubusercontent.com/u/770675?v=3" width="100px;"/><br /><sub>Paweł Lesiecki</sub>](https://github.com/plesiecki)<br />[💻](https://github.com/ben-eb/postcss-discard-unused/commits?author=plesiecki) [⚠️](https://github.com/ben-eb/postcss-discard-unused/commits?author=plesiecki) |
| :---: | :---: | :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors] specification. Contributions of
any kind welcome!

## License

MIT © [Ben Briggs](http://beneb.info)


[all-contributors]: https://github.com/kentcdodds/all-contributors
[ci]:      https://travis-ci.org/ben-eb/postcss-discard-unused
[deps]:    https://gemnasium.com/ben-eb/postcss-discard-unused
[npm]:     http://badge.fury.io/js/postcss-discard-unused
[postcss]: https://github.com/postcss/postcss
[mfv]:     https://github.com/trysound/postcss-minify-font-values
