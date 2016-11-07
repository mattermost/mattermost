# exports loader for webpack

## Usage

``` javascript
require("exports?file,parse=helpers.parse!./file.js");
// adds below code the the file's source:
//  exports["file"] = file;
//  exports["parse"] = helpers.parse;

require("exports?file!./file.js");
// adds below code the the file's source:
//  module.exports = file;
```

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

## License

MIT (http://www.opensource.org/licenses/mit-license.php)
