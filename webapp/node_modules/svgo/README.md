**english** | [русский](https://github.com/svg/svgo/blob/master/README.ru.md)
- - -

<img src="https://svg.github.io/svgo-logo.svg" width="200" height="200" alt="logo"/>

## SVGO [![NPM version](https://badge.fury.io/js/svgo.svg)](https://npmjs.org/package/svgo) [![Dependency Status](https://gemnasium.com/svg/svgo.svg)](https://gemnasium.com/svg/svgo) [![Build Status](https://secure.travis-ci.org/svg/svgo.svg)](https://travis-ci.org/svg/svgo) [![Coverage Status](https://img.shields.io/coveralls/svg/svgo.svg)](https://coveralls.io/r/svg/svgo?branch=master)

**SVG O**ptimizer is a Nodejs-based tool for optimizing SVG vector graphics files.
![](https://mc.yandex.ru/watch/18431326)

## Why?

SVG files, especially exported from various editors, usually contain a lot of redundant and useless information such as editor metadata, comments, hidden elements, default or non-optimal values and other stuff that can be safely removed or converted without affecting SVG rendering result.

## What it can do

SVGO has a plugin-based architecture, so almost every optimization is a separate plugin.

Today we have:

* [ [ cleanupAttrs](https://github.com/svg/svgo/blob/master/plugins/cleanupAttrs.js) ] cleanup attributes from newlines, trailing and repeating spaces
* [ [ removeDoctype](https://github.com/svg/svgo/blob/master/plugins/removeDoctype.js) ] remove doctype declaration
* [ [ removeXMLProcInst](https://github.com/svg/svgo/blob/master/plugins/removeXMLProcInst.js) ] remove XML processing instructions
* [ [ removeComments](https://github.com/svg/svgo/blob/master/plugins/removeComments.js) ] remove comments
* [ [ removeMetadata](https://github.com/svg/svgo/blob/master/plugins/removeMetadata.js) ] remove `<metadata>`
* [ [ removeTitle](https://github.com/svg/svgo/blob/master/plugins/removeTitle.js) ] remove `<title>` (disabled by default)
* [ [ removeDesc](https://github.com/svg/svgo/blob/master/plugins/removeDesc.js) ] remove `<desc>` (only non-meaningful by default)
* [ [ removeUselessDefs](https://github.com/svg/svgo/blob/master/plugins/removeUselessDefs.js) ] remove elements of `<defs>` without `id`
* [ [ removeXMLNS](https://github.com/svg/svgo/blob/master/plugins/removeXMLNS.js) ] removes xmlns attribute (for inline svg, disabled by default)
* [ [ removeEditorsNSData](https://github.com/svg/svgo/blob/master/plugins/removeEditorsNSData.js) ] remove editors namespaces, elements and attributes
* [ [ removeEmptyAttrs](https://github.com/svg/svgo/blob/master/plugins/removeEmptyAttrs.js) ] remove empty attributes
* [ [ removeHiddenElems](https://github.com/svg/svgo/blob/master/plugins/removeHiddenElems.js) ] remove hidden elements
* [ [ removeEmptyText](https://github.com/svg/svgo/blob/master/plugins/removeEmptyText.js) ] remove empty Text elements
* [ [ removeEmptyContainers](https://github.com/svg/svgo/blob/master/plugins/removeEmptyContainers.js) ] remove empty Container elements
* [ [ removeViewBox](https://github.com/svg/svgo/blob/master/plugins/removeViewBox.js) ] remove `viewBox` attribute when possible (disabled by default)
* [ [ cleanUpEnableBackground](https://github.com/svg/svgo/blob/master/plugins/cleanupEnableBackground.js) ] remove or cleanup `enable-background` attribute when possible
* [ [ minifyStyles](https://github.com/svg/svgo/blob/master/plugins/minifyStyles.js) ] minify `<style>` elements content with [CSSO](https://github.com/css/csso)
* [ [ convertStyleToAttrs](https://github.com/svg/svgo/blob/master/plugins/convertStyleToAttrs.js) ] convert styles into attributes
* [ [ convertColors](https://github.com/svg/svgo/blob/master/plugins/convertColors.js) ] convert colors (from `rgb()` to `#rrggbb`, from `#rrggbb` to `#rgb`)
* [ [ convertPathData](https://github.com/svg/svgo/blob/master/plugins/convertPathData.js) ] convert Path data to relative or absolute whichever is shorter, convert one segment to another, trim useless delimiters, smart rounding and much more
* [ [ convertTransform](https://github.com/svg/svgo/blob/master/plugins/convertTransform.js) ] collapse multiple transforms into one, convert matrices to the short aliases and much more
* [ [ removeUnknownsAndDefaults](https://github.com/svg/svgo/blob/master/plugins/removeUnknownsAndDefaults.js) ] remove unknown elements content and attributes, remove attrs with default values
* [ [ removeNonInheritableGroupAttrs](https://github.com/svg/svgo/blob/master/plugins/removeNonInheritableGroupAttrs.js) ] remove non-inheritable group's "presentation" attributes
* [ [ removeUselessStrokeAndFill](https://github.com/svg/svgo/blob/master/plugins/removeUselessStrokeAndFill.js) ] remove useless stroke and fill attrs
* [ [ removeUnusedNS](https://github.com/svg/svgo/blob/master/plugins/removeUnusedNS.js) ] remove unused namespaces declaration
* [ [ cleanupIDs](https://github.com/svg/svgo/blob/master/plugins/cleanupIDs.js) ] remove unused and minify used IDs
* [ [ cleanupNumericValues](https://github.com/svg/svgo/blob/master/plugins/cleanupNumericValues.js) ] round numeric values to the fixed precision, remove default 'px' units
* [ [ cleanupListOfValues](https://github.com/svg/svgo/blob/master/plugins/cleanupListOfValues.js) ] round numeric values in attributes that take a list of numbers, like `viewBox` or `enableBackground`
* [ [ moveElemsAttrsToGroup](https://github.com/svg/svgo/blob/master/plugins/moveElemsAttrsToGroup.js) ] move elements attributes to the existing group wrapper
* [ [ moveGroupAttrsToElems](https://github.com/svg/svgo/blob/master/plugins/moveGroupAttrsToElems.js) ] move some group attributes to the content elements
* [ [ collapseGroups](https://github.com/svg/svgo/blob/master/plugins/collapseGroups.js) ] collapse useless groups
* [ [ removeRasterImages](https://github.com/svg/svgo/blob/master/plugins/removeRasterImages.js) ] remove raster images (disabled by default)
* [ [ mergePaths](https://github.com/svg/svgo/blob/master/plugins/mergePaths.js) ] merge multiple Paths into one
* [ [ convertShapeToPath](https://github.com/svg/svgo/blob/master/plugins/convertShapeToPath.js) ] convert some basic shapes to path
* [ [ sortAttrs](https://github.com/svg/svgo/blob/master/plugins/sortAttrs.js) ] sort element attributes for epic readability (disabled by default)
* [ [ transformsWithOnePath](https://github.com/svg/svgo/blob/master/plugins/transformsWithOnePath.js) ] apply transforms, crop by real width, center vertical alignment and resize SVG with one Path inside (disabled by default)
* [ [ removeDimensions](https://github.com/svg/svgo/blob/master/plugins/removeDimensions.js) ] remove width/height attributes if viewBox is present (disabled by default)
* [ [ removeAttrs](https://github.com/svg/svgo/blob/master/plugins/removeAttrs.js) ] remove attributes by pattern (disabled by default)
* [ [ removeElementsByAttr](https://github.com/svg/svgo/blob/master/plugins/removeElementsByAttr.js) ] remove arbitrary elements by ID or className (disabled by default)
* [ [ addClassesToSVGElement](https://github.com/svg/svgo/blob/master/plugins/addClassesToSVGElement.js) ] add classnames to an outer `<svg>` element (disabled by default)
* [ [ addAttributesToSVGElement](https://github.com/svg/svgo/blob/master/plugins/addAttributesToSVGElement.js) ] adds attributes to an outer `<svg>` element (disabled by default)
* [ [ removeStyleElement](https://github.com/svg/svgo/blob/master/plugins/removeStyleElement.js) ] remove `<style>` elements (disabled by default)

Want to know how it works and how to write your own plugin? [Of course you want to](https://github.com/svg/svgo/blob/master/docs/how-it-works/en.md). ([동작방법](https://github.com/svg/svgo/blob/master/docs/how-it-works/ko.md))


## How to use

```sh
$ [sudo] npm install -g svgo
```

```
Usage:
  svgo [OPTIONS] [ARGS]

Options:
  -h, --help : Help
  -v, --version : Version
  -i INPUT, --input=INPUT : Input file, "-" for STDIN
  -s STRING, --string=STRING : Input SVG data string
  -f FOLDER, --folder=FOLDER : Input folder, optimize and rewrite all *.svg files
  -o OUTPUT, --output=OUTPUT : Output file or folder (by default the same as the input), "-" for STDOUT
  -p PRECISION, --precision=PRECISION : Set number of digits in the fractional part, overrides plugins params
  --config=CONFIG : Config file to extend or replace default
  --disable=DISABLE : Disable plugin by name
  --enable=ENABLE : Enable plugin by name
  --datauri=DATAURI : Output as Data URI string (base64, URI encoded or unencoded)
  -q, --quiet : Only output error messages, not regular status messages
  --pretty : Make SVG pretty printed
  --show-plugins : Show available plugins and exit
  --multipass : Enable multipass
  --indent=INDENT : Indent number when pretty printing SVGs

Arguments:
  INPUT : Alias to --input
  OUTPUT : Alias to --output
```

* with files:

        $ svgo test.svg

    or:

        $ svgo test.svg test.min.svg

* with STDIN / STDOUT:

        $ cat test.svg | svgo -i - -o - > test.min.svg

* with folder

        $ svgo -f ../path/to/folder/with/svg/files

    or:

        $ svgo -f ../path/to/folder/with/svg/files -o ../path/to/folder/with/svg/output

* with strings:

        $ svgo -s '<svg version="1.1">test</svg>' -o test.min.svg

    or even with Data URI base64:

        $ svgo -s 'data:image/svg+xml;base64,…' -o test.min.svg

* with SVGZ:

    from `.svgz` to `.svg`:

        $ gunzip -c test.svgz | svgo -i - -o test.min.svg

    from `.svg` to `.svgz`:

        $ svgo test.svg -o - | gzip -cfq9 > test.svgz

* with GUI – [svgo-gui](https://github.com/svg/svgo-gui)
* as a web app - [SVGOMG](https://jakearchibald.github.io/svgomg/)
* as a Nodejs module – [examples](https://github.com/svg/svgo/tree/master/examples)
* as a Grunt task – [grunt-svgmin](https://github.com/sindresorhus/grunt-svgmin)
* as a Gulp task – [gulp-svgmin](https://github.com/ben-eb/gulp-svgmin)
* as a Mimosa module – [mimosa-minify-svg](https://github.com/dbashford/mimosa-minify-svg)
* as an OSX Folder Action – [svgo-osx-folder-action](https://github.com/svg/svgo-osx-folder-action)
* as a webpack loader – [image-webpack-loader](https://github.com/tcoopman/image-webpack-loader)

## License and copyrights

This software is released under the terms of the [MIT license](https://github.com/svg/svgo/blob/master/LICENSE).

Logo by [Yegor Bolshakov](http://xizzzy.ru/).
