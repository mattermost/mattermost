# decompress [![Build Status](https://travis-ci.org/kevva/decompress.svg?branch=master)](https://travis-ci.org/kevva/decompress)

> Extracting archives made easy

*See [decompress-cli](https://github.com/kevva/decompress-cli) for the command-line version.*

## Install

```
$ npm install --save decompress
```


## Usage

```js
const Decompress = require('decompress');

new Decompress({mode: '755'})
	.src('foo.zip')
	.dest('dest')
	.use(Decompress.zip({strip: 1}))
	.run();
```


## API

### new Decompress(options)

Creates a new `Decompress` instance.

#### options.mode

Type: `string`

Set mode on the extracted files, i.e `{ mode: '755' }`.

#### options.strip

Type: `number`

Equivalent to `--strip-components` for tar.

### .src(files)

#### files

Type: `array`, `buffer` or `string`

Set the files to be extracted.

### .dest(path)

#### path

Type: `string`

Set the destination to where your file will be extracted to.

### .use(plugin)

#### plugin

Type: `function`

Add a `plugin` to the middleware stack.

### .run(callback)

Extract your file with the given settings.

#### callback(err, files)

Type: `function`

The callback will return an array of vinyl files in `files`.


## Plugins

The following [plugins](https://www.npmjs.org/browse/keyword/decompressplugin) are bundled with decompress:

* [tar](#tar) — Extract TAR files.
* [tar.bz2](#tarbz2) — Extract TAR.BZ files.
* [tar.gz](#targz) — Extract TAR.GZ files.
* [zip](#zip) — Extract ZIP files.

### .tar(options)

Extract TAR files.

```js
const Decompress = require('decompress');

new Decompress()
	.use(Decompress.tar({strip: 1}));
```

### .tarbz2(options)

Extract TAR.BZ files.

```js
const Decompress = require('decompress');

new Decompress()
	.use(Decompress.tarbz2({strip: 1}));
```

### .targz(options)

Extract TAR.GZ files.

```js
const Decompress = require('decompress');

new Decompress()
	.use(Decompress.targz({strip: 1}));
```

### .zip(options)

Extract ZIP files.

```js
const Decompress = require('decompress');

new Decompress()
	.use(Decompress.zip({strip: 1}));
```


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
