# url loader for webpack

## Usage

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

The `url` loader works like the `file` loader, but can return a Data Url if the file is smaller than a limit.

The limit can be specified with a query parameter. (Defaults to no limit)

If the file is greater than the limit the [`file-loader`](https://github.com/webpack/file-loader) is used and all query parameters are passed to it.

``` javascript
require("url?limit=10000!./file.png");
// => DataUrl if "file.png" is smaller that 10kb

require("url?mimetype=image/png!./file.png");
// => Specify mimetype for the file (Otherwise it's inferred from extension.)

require("url?prefix=img/!./file.png");
// => Parameters for the file-loader are valid too
//    They are passed to the file-loader if used.
```

## License

MIT (http://www.opensource.org/licenses/mit-license.php)
