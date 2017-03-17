'use strict';
var PrettyError = require('pretty-error');
var prettyError = new PrettyError();
prettyError.withoutColors();
prettyError.skipPackage(['html-plugin-evaluation']);
prettyError.skipNodeFiles();
prettyError.skip(function (traceLine) {
  return traceLine.path === 'html-plugin-evaluation';
});

module.exports = function (err, context) {
  return {
    toHtml: function () {
      return 'Html Webpack Plugin:\n<pre>\n' + this.toString() + '</pre>';
    },
    toJsonHtml: function () {
      return JSON.stringify(this.toHtml());
    },
    toString: function () {
      return prettyError.render(err).replace(/webpack:\/\/\/\./g, context);
    }
  };
};
