'use strict';

var babelHelpers = require('./util/babelHelpers.js');

exports.__esModule = true;
exports['default'] = ownerWindow;

var _ownerDocument = require('./ownerDocument');

var _ownerDocument2 = babelHelpers.interopRequireDefault(_ownerDocument);

function ownerWindow(node) {
  var doc = (0, _ownerDocument2['default'])(node);
  return doc && doc.defaultView || doc.parentWindow;
}

module.exports = exports['default'];