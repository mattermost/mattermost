var sass = require('node-sass');
var libDir = __dirname.replace(/test\/helper$/, 'lib');
var chalk = require('chalk');

module.exports = function(data, callback, imports) {
  imports = imports ? imports.map(function(i){ return '@import "'+libDir+'/'+i+'";'}) : [];

  sass.render({
    data: '@import "'+libDir+'/compass/functions";' + imports.join('') + data,
    outputStyle: 'compressed',
    includePaths: [__dirname],
  }, function(err, output) {
    if (err) {
      console.log(chalk.red("Sass error:"), err);
      callback('', err);
    } else {
      callback(output.css.toString().trim());
    }
  });
}
