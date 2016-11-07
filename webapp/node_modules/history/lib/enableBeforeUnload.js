'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _deprecate = require('./deprecate');

var _deprecate2 = _interopRequireDefault(_deprecate);

var _useBeforeUnload = require('./useBeforeUnload');

var _useBeforeUnload2 = _interopRequireDefault(_useBeforeUnload);

exports['default'] = _deprecate2['default'](_useBeforeUnload2['default'], 'enableBeforeUnload is deprecated, use useBeforeUnload instead');
module.exports = exports['default'];