'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _border = require('./rules/border');

var _border2 = _interopRequireDefault(_border);

var _boxShadow = require('./rules/boxShadow');

var _boxShadow2 = _interopRequireDefault(_boxShadow);

var _flexFlow = require('./rules/flexFlow');

var _flexFlow2 = _interopRequireDefault(_flexFlow);

var _transition = require('./rules/transition');

var _transition2 = _interopRequireDefault(_transition);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// rules


var rules = [_border2.default, _boxShadow2.default, _flexFlow2.default, _transition2.default];

exports.default = _postcss2.default.plugin('postcss-ordered-values', function () {
    return function (css) {
        return css.walkDecls(function (decl) {
            return rules.forEach(function (rule) {
                return rule(decl);
            });
        });
    };
});
module.exports = exports['default'];