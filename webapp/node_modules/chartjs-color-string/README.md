# color-string

[![Build Status](https://travis-ci.org/harthur/color-string.svg?branch=master)](https://travis-ci.org/harthur/color-string)

> library for parsing and generating CSS color strings.

## Install

With [npm](http://npmjs.org/):

```console
$ npm install color-string
```

## Usage

### Parsing

```js
colorString.getRgb("#FFF")  // [255, 255, 255]
colorString.getRgb("blue")  // [0, 0, 255]

colorString.getRgba("rgba(200, 60, 60, 0.3)")    // [200, 60, 60, 0.3]
colorString.getRgba("rgb(200, 200, 200)")        // [200, 200, 200, 1]

colorString.getHsl("hsl(360, 100%, 50%)")        // [360, 100, 50]
colorString.getHsla("hsla(360, 60%, 50%, 0.4)")  // [360, 60, 50, 0.4]

colorString.getAlpha("rgba(200, 0, 12, 0.6)")    // 0.6
```

### Generation

```js
colorString.hexString([255, 255, 255])   // "#FFFFFF"
colorString.rgbString([255, 255, 255])   // "rgb(255, 255, 255)"
colorString.rgbString([0, 0, 255, 0.4])  // "rgba(0, 0, 255, 0.4)"
colorString.rgbString([0, 0, 255], 0.4)  // "rgba(0, 0, 255, 0.4)"
colorString.percentString([0, 0, 255])   // "rgb(0%, 0%, 100%)"
colorString.keyword([255, 255, 0])       // "yellow"
colorString.hslString([360, 100, 100])   // "hsl(360, 100%, 100%)"
```
