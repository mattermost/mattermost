# gulp-header [![NPM version](https://badge.fury.io/js/gulp-header.png)](http://badge.fury.io/js/gulp-header) [![Build Status](https://travis-ci.org/tracker1/gulp-header.svg?branch=master)](https://travis-ci.org/tracker1/gulp-header)

gulp-header is a [Gulp](https://github.com/gulpjs/gulp) extension to add a header to file(s) in the pipeline.  [Gulp is a streaming build system](https://github.com/gulpjs/gulp) utilizing [node.js](http://nodejs.org/).

## Install

```javascript
npm install --save-dev gulp-header
```

## Usage

```javascript
// assign the module to a local variable
var header = require('gulp-header');


// literal string
// NOTE: a line separator will not be added automatically
gulp.src('./foo/*.js')
  .pipe(header('Hello'))
  .pipe(gulp.dest('./dist/'))


// ejs style templating
gulp.src('./foo/*.js')
  .pipe(header('Hello <%= name %>\n', { name : 'World'} ))
  .pipe(gulp.dest('./dist/'))


// ES6-style template string
gulp.src('./foo/*.js')
  .pipe(header('Hello ${name}\n', { name : 'World'} ))
  .pipe(gulp.dest('./dist/'))


// using data from package.json
var pkg = require('./package.json');
var banner = ['/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' */',
  ''].join('\n');

gulp.src('./foo/*.js')
  .pipe(header(banner, { pkg : pkg } ))
  .pipe(gulp.dest('./dist/'))


// reading the header file from disk
var fs = require('fs');
gulp.src('./foo/*.js')
  .pipe(header(fs.readFileSync('header.txt', 'utf8'), { pkg : pkg } ))
  .pipe(gulp.dest('./dist/'))
```

## Issues and Alerts

My handle on twitter is [@tracker1](https://twitter.com/tracker1) - If there is an urgent issue, I get twitter notifications sent to my phone.

## API

### header(text, data)

#### text

Type: `String`
Default: `''`

The template text.


#### data

Type: `Object`
Default: `{}`

The data object used to populate the text.

In addition to the passed in data, `file` will be the stream object for the file being templated against and `filepath` will be the path relative from the stream's basepath.

*NOTE: using `false` will disable template processing of the header*
