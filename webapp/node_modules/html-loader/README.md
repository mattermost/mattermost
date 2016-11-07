[![npm][npm]][npm-url]
[![deps][deps]][deps-url]
[![test][test]][test-url]
[![coverage][cover]][cover-url]
[![chat][chat]][chat-url]

<div align="center">
  <img width="200" height="200"
    src="https://worldvectorlogo.com/logos/html5.svg">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200" vspace="" hspace="25"
      src="https://worldvectorlogo.com/logos/webpack.svg">
  </a>
  <h1>HTML Loader</h1>
  <p>Exports HTML as string. HTML is minimized when the compiler demands.<p>
</div>

<h2 align="center">Install</h2>

```bash
npm i -D html-loader
```

<h2 align="center">Usage</h2>

By default every local `<img src="image.png">` is required (`require('./image.png')`). You may need to specify loaders for images in your configuration (recommended `file-loader` or `url-loader`).

You can specify which tag-attribute combination should be processed by this loader via the query parameter `attrs`. Pass an array or a space-separated list of `<tag>:<attribute>` combinations. (Default: `attrs=img:src`)

To completely disable tag-attribute processing (for instance, if you're handling image loading on the client side) you can pass in `attrs=false`.

<h2 align="center">Examples</h2>

With this configuration:

```js
{
  module: {
    loaders: [
      { test: /\.jpg$/, loader: "file-loader" },
      { test: /\.png$/, loader: "url-loader?mimetype=image/png" }
    ]
  },
  output: {
    publicPath: "http://cdn.example.com/[hash]/"
  }
}
```

``` html
<!-- file.html -->
<img src="image.png" data-src="image2x.png" >
```

```js
require("html!./file.html");

// => '<img src="http://cdn.example.com/49eba9f/a992ca.png"
//         data-src="image2x.png">'
```

```js
require("html?attrs=img:data-src!./file.html");

// => '<img src="image.png" data-src="data:image/png;base64,..." >'
```

```js
require("html?attrs=img:src img:data-src!./file.html");
require("html?attrs[]=img:src&attrs[]=img:data-src!./file.html");

// => '<img  src="http://cdn.example.com/49eba9f/a992ca.png"        
//           data-src="data:image/png;base64,..." >'
```

```js
require("html?-attrs!./file.html");

// => '<img  src="image.jpg"  data-src="image2x.png" >'
```

minimized by running `webpack --optimize-minimize`

```html
'<img src=http://cdn.example.com/49eba9f/a9f92ca.jpg
      data-src=data:image/png;base64,...>'
```

### 'Root-relative' URLs

For urls that start with a `/`, the default behavior is to not translate them.
If a `root` query parameter is set, however, it will be prepended to the url
and then translated.

With the same configuration as above:

``` html
<!-- file.html -->
<img src="/image.jpg">
```

```js
require("html!./file.html");

// => '<img  src="/image.jpg">'
```

```js
require("html?root=.!./file.html");

// => '<img  src="http://cdn.example.com/49eba9f/a992ca.jpg">'
```

### Interpolation

You can use `interpolate` flag to enable interpolation syntax for ES6 template strings, like so:

```js
require("html?interpolate!./file.html");
```

```html
<img src="${require(`./images/gallery.png`)}">

<div>${require('./components/gallery.html')}</div>
```
And if you only want to use `require` in template and any other `${}` are not to be translate you can set `interpolate` flag to `require`, like so:

```js
require("html?interpolate=require!./file.ftl");
```

```html

<#list list as list>
  <a href="${list.href!}" />${list.name}</a>
</#list>

<img src="${require(`./images/gallery.png`)}">

<div>${require('./components/gallery.html')}</div>
```

### Advanced options

If you need to pass [more advanced options](https://github.com/webpack/html-loader/pull/46), especially those which cannot be stringified, you can also define an `htmlLoader`-property on your `webpack.config.js`:

```js
var path = require('path')

module.exports = {
  ...
  module: {
    loaders: [
      {
        test: /\.html$/,
        loader: "html"
      }
    ]
  }
  htmlLoader: {
    ignoreCustomFragments: [/\{\{.*?}}/],
    root: path.resolve(__dirname, 'assets'),
    attrs: ['img:src', 'link:href']
  }
};
```

If you need to define two different loader configs, you can also change the config's property name via `html?config=otherHtmlLoaderConfig`:

```js
module.exports = {
  ...
  module: {
    loaders: [
      {
        test: /\.html$/,
        loader: "html?config=otherHtmlLoaderConfig"
      }
    ]
  }
  otherHtmlLoaderConfig: {
    ...
  }
};
```

<h2 align="center">Maintainers</h2>

<table>
  <tbody>
    <tr>
      <td align="center">
        <img width="150 height="150"
        src="https://avatars.githubusercontent.com/u/18315?v=3">
        <a href="https://github.com/hemanth">Hermanth</a>
      </td>
      <td align="center">
        <img width="150 height="150"
        src="https://avatars.githubusercontent.com/u/8420490?v=3">
        <a href="https://github.com/d3viant0ne">Joshua Wiens</a>
      </td>
      <td align="center">
        <img width="150" height="150" src="https://avatars.githubusercontent.com/u/5419992?v=3">
        <a href="https://github.com/michael-ciniawsky">Michael Ciniawsky</a>
      </td>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars.githubusercontent.com/u/6542274?v=3">
        <a href="https://github.com/imvetri">Imvetri</a>
      </td>
    <tr>
    <tr>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars.githubusercontent.com/u/1520965?v=3">
        <a href="https://github.com/andreicek">Andrei Crnković</a>
      </td>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars.githubusercontent.com/u/3367801?v=3">
        <a href="https://github.com/abouthiroppy">Yuta Hiroto</a>
      </td>
      <td align="center">
        <img width="150" height="150" src="https://avatars.githubusercontent.com/u/80044?v=3">
        <a href="https://github.com/petrunov">Vesselin Petrunov</a>
      </td>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars.githubusercontent.com/u/973543?v=3">
        <a href="https://github.com/gajus">Gajus Kuizinas</a>
      </td>
    <tr>
  <tbody>
</table>

<h2 align="center">LICENSE</h2>

> MIT

> http://www.opensource.org/licenses/mit-license.php

> Copyright (c) 2016 Tobias Koppers @sokra

> Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

> The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

[npm]: https://img.shields.io/npm/v/html-loader.svg
[npm-url]: https://npmjs.com/package/html-loader

[deps]: https://david-dm.org/webpack/html-loader.svg
[deps-url]: https://david-dm.org/webpack/html-loader

[chat]: https://img.shields.io/badge/gitter-webpack%2Fwebpack-brightgreen.svg
[chat-url]: https://gitter.im/webpack/webpack

[test]: http://img.shields.io/travis/webpack/html-loader.svg
[test-url]: https://travis-ci.org/webpack/html-loader

[cover]: https://codecov.io/gh/webpack/html-loader/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack/html-loader
