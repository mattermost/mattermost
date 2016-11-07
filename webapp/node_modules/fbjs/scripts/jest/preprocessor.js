var assign = require('object-assign');
var babel = require('babel');
var babelDefaultOptions = require('../babel/default-options');

var babelOpts = babelDefaultOptions;

module.exports = {
  process: function(src, path) {
    // TODO: Use preprocessorIgnorePatterns when it works.
    // See https://github.com/facebook/jest/issues/385.
    if (!path.match(/\/node_modules\//) && !path.match(/\/third_party\//)) {
      return babel.transform(src, assign({filename: path}, babelOpts)).code;
    }
    return src;
  }
};
