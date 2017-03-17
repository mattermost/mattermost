'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _values = require('../data/values.json');

var _values2 = _interopRequireDefault(_values);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _postcss.plugin)('postcss-reduce-initial', function () {
    return function (css) {
        css.walkDecls(function (decl) {
            if (decl.value !== 'initial') {
                return;
            }
            if (_values2.default[decl.prop]) {
                decl.value = _values2.default[decl.prop];
            }
        });
    };
});
module.exports = exports['default'];