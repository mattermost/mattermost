'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _convert = require('./lib/convert');

var _convert2 = _interopRequireDefault(_convert);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parseWord(node, opts, keepZeroUnit) {
    var pair = (0, _postcssValueParser.unit)(node.value);
    if (pair) {
        var num = Number(pair.number);
        var u = pair.unit.toLowerCase();
        if (num === 0) {
            node.value = keepZeroUnit || u === 'ms' || u === 's' || u === 'deg' || u === 'rad' || u === 'grad' || u === 'turn' ? 0 + u : 0;
        } else {
            node.value = (0, _convert2.default)(num, u, opts);

            if (typeof opts.precision === 'number' && u === 'px' && ~pair.number.indexOf('.')) {
                var precision = Math.pow(10, opts.precision);
                node.value = Math.round(parseFloat(node.value) * precision) / precision + u;
            }
        }
    }
}

function shouldStripPercent(_ref) {
    var value = _ref.value;
    var prop = _ref.prop;
    var parent = _ref.parent;

    return ~value.indexOf('%') && (prop === 'max-height' || prop === 'height') || parent.parent && parent.parent.name === 'keyframes' && prop === 'stroke-dasharray' || prop === 'stroke-dashoffset' || prop === 'stroke-width';
}

function transform(opts) {
    return function (decl) {
        if (~decl.prop.indexOf('flex') || decl.prop.indexOf('--') === 0) {
            return;
        }

        decl.value = (0, _postcssValueParser2.default)(decl.value).walk(function (node) {
            if (node.type === 'word') {
                parseWord(node, opts, shouldStripPercent(decl));
            } else if (node.type === 'function') {
                if (node.value === 'calc' || node.value === 'hsl' || node.value === 'hsla') {
                    (0, _postcssValueParser.walk)(node.nodes, function (n) {
                        if (n.type === 'word') {
                            parseWord(n, opts, true);
                        }
                    });
                    return false;
                }
                if (node.value === 'url') {
                    return false;
                }
            }
        }).toString();
    };
}

var plugin = 'postcss-convert-values';

exports.default = _postcss2.default.plugin(plugin, function () {
    var opts = arguments.length <= 0 || arguments[0] === undefined ? { precision: false } : arguments[0];

    if (opts.length === undefined && opts.convertLength !== undefined) {
        console.warn(plugin + ': `convertLength` option is deprecated. Use `length`');
        opts.length = opts.convertLength;
    }
    if (opts.length === undefined && opts.convertTime !== undefined) {
        console.warn(plugin + ': `convertTime` option is deprecated. Use `time`');
        opts.time = opts.convertTime;
    }
    return function (css) {
        return css.walkDecls(transform(opts));
    };
});
module.exports = exports['default'];