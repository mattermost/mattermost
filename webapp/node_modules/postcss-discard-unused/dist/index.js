'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _uniqs = require('uniqs');

var _uniqs2 = _interopRequireDefault(_uniqs);

var _postcss = require('postcss');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var comma = _postcss.list.comma;
var space = _postcss.list.space;


var atrule = 'atrule';
var decl = 'decl';
var rule = 'rule';

function addValues(cache, _ref) {
    var value = _ref.value;

    return comma(value).reduce(function (memo, val) {
        return [].concat(memo, space(val));
    }, cache);
}

function filterAtRule(_ref2) {
    var atRules = _ref2.atRules;
    var values = _ref2.values;

    values = (0, _uniqs2.default)(values);
    atRules.forEach(function (node) {
        var hasAtRule = values.some(function (value) {
            return value === node.params;
        });
        if (!hasAtRule) {
            node.remove();
        }
    });
}

function filterNamespace(_ref3) {
    var atRules = _ref3.atRules;
    var rules = _ref3.rules;

    rules = (0, _uniqs2.default)(rules);
    atRules.forEach(function (atRule) {
        var _atRule$params$split$ = atRule.params.split(' ').filter(Boolean);

        var param = _atRule$params$split$[0];
        var len = _atRule$params$split$.length;

        if (len === 1) {
            return;
        }
        var hasRule = rules.some(function (r) {
            return r === param || r === '*';
        });
        if (!hasRule) {
            atRule.remove();
        }
    });
}

function hasFont(fontFamily, cache) {
    return comma(fontFamily).some(function (font) {
        return cache.some(function (c) {
            return ~c.indexOf(font);
        });
    });
}

// fonts have slightly different logic
function filterFont(_ref4) {
    var atRules = _ref4.atRules;
    var values = _ref4.values;

    values = (0, _uniqs2.default)(values);
    atRules.forEach(function (r) {
        var families = r.nodes.filter(function (_ref5) {
            var prop = _ref5.prop;
            return prop === 'font-family';
        });
        // Discard the @font-face if it has no font-family
        if (!families.length) {
            return r.remove();
        }
        families.forEach(function (family) {
            if (!hasFont(family.value, values)) {
                r.remove();
            }
        });
    });
}

exports.default = (0, _postcss.plugin)('postcss-discard-unused', function (opts) {
    var _fontFace$counterStyl = _extends({
        fontFace: true,
        counterStyle: true,
        keyframes: true,
        namespace: true
    }, opts);

    var fontFace = _fontFace$counterStyl.fontFace;
    var counterStyle = _fontFace$counterStyl.counterStyle;
    var keyframes = _fontFace$counterStyl.keyframes;
    var namespace = _fontFace$counterStyl.namespace;

    return function (css) {
        var counterStyleCache = { atRules: [], values: [] };
        var keyframesCache = { atRules: [], values: [] };
        var namespaceCache = { atRules: [], rules: [] };
        var fontCache = { atRules: [], values: [] };
        css.walk(function (node) {
            var type = node.type;
            var prop = node.prop;
            var selector = node.selector;
            var name = node.name;

            if (type === rule && namespace && ~selector.indexOf('|')) {
                namespaceCache.rules = namespaceCache.rules.concat(selector.split('|')[0]);
                return;
            }
            if (type === decl) {
                if (counterStyle && /list-style|system/.test(prop)) {
                    counterStyleCache.values = addValues(counterStyleCache.values, node);
                }
                if (fontFace && node.parent.type === rule && /font(|-family)/.test(prop)) {
                    fontCache.values = fontCache.values.concat(comma(node.value));
                }
                if (keyframes && /animation/.test(prop)) {
                    keyframesCache.values = addValues(keyframesCache.values, node);
                }
                return;
            }
            if (type === atrule) {
                if (counterStyle && /counter-style/.test(name)) {
                    counterStyleCache.atRules.push(node);
                }
                if (fontFace && name === 'font-face' && node.nodes) {
                    fontCache.atRules.push(node);
                }
                if (keyframes && /keyframes/.test(name)) {
                    keyframesCache.atRules.push(node);
                }
                if (namespace && name === 'namespace') {
                    namespaceCache.atRules.push(node);
                }
                return;
            }
        });
        counterStyle && filterAtRule(counterStyleCache);
        fontFace && filterFont(fontCache);
        keyframes && filterAtRule(keyframesCache);
        namespace && filterNamespace(namespaceCache);
    };
});
module.exports = exports['default'];