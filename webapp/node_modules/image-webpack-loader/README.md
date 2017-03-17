# image-loader

Image loader module for webpack

> Minify PNG, JPEG, GIF and SVG images with [imagemin](https://github.com/kevva/imagemin)

*Issues with the output should be reported on the imagemin [issue tracker](https://github.com/kevva/imagemin/issues).*

## Install

```sh
$ npm install image-webpack-loader --save-dev
```

## Usage

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

In your `webpack.config.js`, add the image-loader, chained with the [file-loader](https://github.com/webpack/file-loader):

```javascript
loaders: [
    {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loaders: [
            'file?hash=sha512&digest=hex&name=[hash].[ext]',
            'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false'
        ]
    }
]
```

If you want to use [pngquant](https://pngquant.org/) you must use the json options
notation like this:

```javascript
loaders: [
  {
    test: /.*\.(gif|png|jpe?g|svg)$/i,
    loaders: [
      'file?hash=sha512&digest=hex&name=[hash].[ext]',
      'image-webpack?{progressive:true, optimizationLevel: 7, interlaced: false, pngquant:{quality: "65-90", speed: 4}}'
    ]
  }
];
```

You can also use a configuration section in your webpack config to set global options for the loader, which will apply to all loader sections that use the image loader.

```
{
  module: {
    loaders: [
      {
        test: /.*\.(gif|png|jpe?g|svg)$/i,
        loaders: [
          'file?hash=sha512&digest=hex&name=[hash].[ext]',
          'image-webpack'
        ]
      }
    ]
  },

  imageWebpackLoader: {
    pngquant:{
      quality: "65-90",
      speed: 4
    },
    svgo:{
      plugins: [
        {
          removeViewBox: false
        },
        {
          removeEmptyAttrs: false
        }
      ]
    }
  }
}
```

Comes bundled with the following optimizers:

- [gifsicle](https://github.com/kevva/imagemin-gifsicle) — *Compress GIF images*
- [jpegtran](https://github.com/kevva/imagemin-jpegtran) — *Compress JPEG images*
- [optipng](https://github.com/kevva/imagemin-optipng) — *Compress PNG images*
- [svgo](https://github.com/kevva/imagemin-svgo) — *Compress SVG images*
- [pngquant](https://pngquant.org/) — *Compress PNG images*

### imagemin(options)

Unsupported files are ignored.

### options

Options are applied to the correct files.

#### optimizationLevel *(png)*

Type: `number`  
Default: `3`

Select an optimization level between `0` and `7`.

> The optimization level 0 enables a set of optimization operations that require minimal effort. There will be no changes to image attributes like bit depth or color type, and no recompression of existing IDAT datastreams. The optimization level 1 enables a single IDAT compression trial. The trial chosen is what. OptiPNG thinks it’s probably the most effective. The optimization levels 2 and higher enable multiple IDAT compression trials; the higher the level, the more trials.

Level and trials:

1. 1 trial
2. 8 trials
3. 16 trials
4. 24 trials
5. 48 trials
6. 120 trials
7. 240 trials

#### progressive *(jpg)*

Type: `boolean`  
Default: `false`

Lossless conversion to progressive.

#### interlaced *(gif)*

Type: `boolean`  
Default: `false`

Interlace gif for progressive rendering.

#### svgo *(svg)*

Type: `object`
Default: `{}`

Pass options to [svgo](https://github.com/svg/svgo).

#### bypassOnDebug *(all)*

Type: `boolean`  
Default: `false`

Using this, no processing is done when webpack 'debug' mode is used and the loader acts as a regular file-loader. Use this to speed up initial and, to a lesser extent, subsequent compilations while developing or using webpack-dev-server. Normal builds are processed normally, outputting oprimized files.

### imageminPngquant(options)

#### options.floyd

Type: `number`  
Default: `0.5`

Controls level of dithering (0 = none, 1 = full).

#### options.nofs

Type: `boolean`  
Default: `false`

Disable Floyd-Steinberg dithering.

#### options.posterize

Type: `number`

Reduce precision of the palette by number of bits. Use when the image will be
displayed on low-depth screens (e.g. 16-bit displays or compressed textures).

#### options.quality

Type: `string`

Instructs pngquant to use the least amount of colors required to meet or exceed
the max quality. If conversion results in quality below the min quality the
image won't be saved.

Min and max are numbers in range 0 (worst) to 100 (perfect), similar to JPEG.

#### options.speed

Type: `number`  
Default: `3`

Speed/quality trade-off from `1` (brute-force) to `10` (fastest). Speed `10` has
5% lower quality, but is 8 times faster than the default.

#### options.verbose

Type: `boolean`  
Default: `false`

Print verbose status messages.

## Inspiration

* [gulp-imagemin](https://github.com/sindresorhus/gulp-imagemin)
* [file-loader](https://github.com/webpack/file-loader)
* [imagemin-pngquant](https://github.com/imagemin/imagemin-pngquant)

## License

MIT (http://www.opensource.org/licenses/mit-license.php)
