'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _alphanumSort = require('alphanum-sort');

var _alphanumSort2 = _interopRequireDefault(_alphanumSort);

var _unquote = require('./lib/unquote');

var _unquote2 = _interopRequireDefault(_unquote);

var _canUnquote = require('./lib/canUnquote');

var _canUnquote2 = _interopRequireDefault(_canUnquote);

var _postcssSelectorParser = require('postcss-selector-parser');

var _postcssSelectorParser2 = _interopRequireDefault(_postcssSelectorParser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var pseudoElements = ['::before', '::after', '::first-letter', '::first-line'];

function getParsed(selectors, callback) {
    return (0, _postcssSelectorParser2.default)(callback).process(selectors).result;
}

function optimise(rule) {
    var selector = rule.raws.selector && rule.raws.selector.raw || rule.selector;
    // If the selector ends with a ':' it is likely a part of a custom mixin,
    // so just pass through.
    if (selector[selector.length - 1] === ':') {
        return;
    }
    rule.selector = getParsed(selector, function (selectors) {
        selectors.nodes = (0, _alphanumSort2.default)(selectors.nodes, { insensitive: true });
        var uniqueSelectors = [];
        selectors.walk(function (sel) {
            var toString = String(sel);
            // Trim whitespace around the value
            sel.spaces.before = sel.spaces.after = '';
            if (sel.type === 'attribute') {
                if (sel.value) {
                    // Join selectors that are split over new lines
                    sel.value = sel.value.replace(/\\\n/g, '').trim();
                    if ((0, _canUnquote2.default)(sel.value)) {
                        sel.value = (0, _unquote2.default)(sel.value);
                    }
                    sel.operator = sel.operator.trim();
                }
                if (sel.raw) {
                    sel.raw.insensitive = '';
                }
                sel.attribute = sel.attribute.trim();
            }
            if (sel.type === 'combinator') {
                var value = sel.value.trim();
                sel.value = value.length ? value : ' ';
            }
            if (sel.type === 'pseudo') {
                (function () {
                    var uniques = [];
                    sel.walk(function (child) {
                        if (child.type === 'selector') {
                            var childStr = String(child);
                            if (! ~uniques.indexOf(childStr)) {
                                uniques.push(childStr);
                            } else {
                                child.remove();
                            }
                        }
                    });
                    if (~pseudoElements.indexOf(sel.value)) {
                        sel.value = sel.value.slice(1);
                    }
                })();
            }
            if (sel.type === 'selector' && sel.parent.type !== 'pseudo') {
                if (! ~uniqueSelectors.indexOf(toString)) {
                    uniqueSelectors.push(toString);
                } else {
                    sel.remove();
                }
            }
            if (sel.type === 'tag') {
                if (sel.value === 'from') {
                    sel.value = '0%';
                } else if (sel.value === '100%') {
                    sel.value = 'to';
                }
            }
            if (sel.type === 'universal') {
                var next = sel.next();
                if (next && next.type !== 'combinator') {
                    sel.remove();
                }
            }
        });
    });
}

exports.default = _postcss2.default.plugin('postcss-minify-selectors', function () {
    return function (css) {
        return css.walkRules(optimise);
    };
});
module.exports = exports['default'];