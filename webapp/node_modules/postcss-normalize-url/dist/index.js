'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _normalizeUrl = require('normalize-url');

var _normalizeUrl2 = _interopRequireDefault(_normalizeUrl);

var _isAbsoluteUrl = require('is-absolute-url');

var _isAbsoluteUrl2 = _interopRequireDefault(_isAbsoluteUrl);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var multiline = /\\[\r\n]/;
var escapeChars = /([\s\(\)"'])/g;

function convert(url, options) {
    if ((0, _isAbsoluteUrl2.default)(url) || !url.indexOf('//')) {
        return (0, _normalizeUrl2.default)(url, options);
    }
    return _path2.default.normalize(url).replace(new RegExp('\\' + _path2.default.sep, 'g'), '/');
}

function transformNamespace(rule, opts) {
    rule.params = (0, _postcssValueParser2.default)(rule.params).walk(function (node) {
        if (node.type === 'function' && node.value === 'url' && node.nodes.length) {
            node.type = 'string';
            node.quote = node.nodes[0].quote || '"';
            node.value = node.nodes[0].value;
        }

        if (node.type === 'string') {
            node.value = convert(node.value.trim(), opts);
        }

        return false;
    }).toString();
}

function transformDecl(decl, opts) {
    decl.value = (0, _postcssValueParser2.default)(decl.value).walk(function (node) {
        if (node.type !== 'function' || node.value !== 'url' || !node.nodes.length) {
            return false;
        }

        var url = node.nodes[0];
        var escaped = undefined;

        node.before = node.after = '';
        url.value = url.value.trim().replace(multiline, '');

        if (~url.value.indexOf('data:image/') || ~url.value.indexOf('data:application/') || ~url.value.indexOf('data:font/')) {
            return false;
        }

        if (! ~url.value.indexOf('chrome-extension')) {
            url.value = convert(url.value, opts);
        }

        if (escapeChars.test(url.value)) {
            escaped = url.value.replace(escapeChars, '\\$1');
            if (escaped.length < url.value.length + (url.type === 'string' ? 2 : 0)) {
                url.value = escaped;
                url.type = 'word';
            }
        } else {
            url.type = 'word';
        }

        return false;
    }).toString();
}

module.exports = _postcss2.default.plugin('postcss-normalize-url', function (opts) {
    opts = _extends({
        normalizeProtocol: false,
        stripFragment: false,
        stripWWW: true
    }, opts);

    return function (css) {
        css.walk(function (node) {
            if (node.type === 'decl') {
                return transformDecl(node, opts);
            } else if (node.type === 'atrule' && node.name === 'namespace') {
                return transformNamespace(node, opts);
            }
        });
    };
});