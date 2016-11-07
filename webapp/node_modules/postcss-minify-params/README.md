# postcss-minify-params [![Build Status][ci-img]][ci]

> Minify at-rule params with PostCSS.

```css
@media only screen   and ( min-width: 400px, min-height: 500px ) {
    h2{
        color:blue
    }
}
```

```css
@media only screen and (min-width:400px,min-height:500px) {
    h2{
        color:blue
    }
}
```

## Usage

```js
postcss([ require('postcss-minify-params') ])
```

See [PostCSS] docs for examples for your environment.

MIT © [Bogdan Chadkin](mailto:trysound@yandex.ru)

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/TrySound/postcss-minify-params.svg
[ci]:      https://travis-ci.org/TrySound/postcss-minify-params
