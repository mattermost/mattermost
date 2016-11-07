'use strict';

exports.__esModule = true;

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _encode = require('./lib/encode');

var _encode2 = _interopRequireDefault(_encode);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isNum(node) {
    return (0, _postcssValueParser.unit)(node.value);
}

function transformAtRule(_ref) {
    var cache = _ref.cache;
    var ruleCache = _ref.ruleCache;
    var declCache = _ref.declCache;

    // Iterate each property and change their names
    declCache.forEach(function (decl) {
        decl.value = (0, _postcssValueParser2.default)(decl.value).walk(function (node) {
            if (node.type === 'word' && node.value in cache) {
                cache[node.value].count++;
                node.value = cache[node.value].ident;
            } else if (node.type === 'space') {
                node.value = ' ';
            } else if (node.type === 'div') {
                node.before = node.after = '';
            }
        }).toString();
    });
    // Ensure that at rules with no references to them are left unchanged
    ruleCache.forEach(function (rule) {
        Object.keys(cache).forEach(function (key) {
            var cached = cache[key];
            if (cached.ident === rule.params && !cached.count) {
                rule.params = key;
            }
        });
    });
}

function transformDecl(_ref2) {
    var cache = _ref2.cache;
    var declOneCache = _ref2.declOneCache;
    var declTwoCache = _ref2.declTwoCache;

    declTwoCache.forEach(function (decl) {
        decl.value = (0, _postcssValueParser2.default)(decl.value).walk(function (node) {
            var type = node.type;
            var value = node.value;

            if (type === 'function' && (value === 'counter' || value === 'counters')) {
                (0, _postcssValueParser.walk)(node.nodes, function (child) {
                    if (child.type === 'word' && child.value in cache) {
                        cache[child.value].count++;
                        child.value = cache[child.value].ident;
                    } else if (child.type === 'div') {
                        child.before = child.after = '';
                    }
                });
            }
            if (type === 'space') {
                node.value = ' ';
            }
            return false;
        }).toString();
    });
    declOneCache.forEach(function (decl) {
        decl.value = decl.value.walk(function (node) {
            if (node.type === 'word' && !isNum(node)) {
                Object.keys(cache).forEach(function (key) {
                    var cached = cache[key];
                    if (cached.ident === node.value && !cached.count) {
                        node.value = key;
                    }
                });
            }
        }).toString();
    });
}

function addToCache(value, encoder, cache) {
    if (cache[value]) {
        return;
    }
    cache[value] = {
        ident: encoder(value, Object.keys(cache).length),
        count: 0
    };
}

function cacheAtRule(node, encoder, _ref3) {
    var cache = _ref3.cache;
    var ruleCache = _ref3.ruleCache;
    var params = node.params;

    addToCache(params, encoder, cache);
    node.params = cache[params].ident;
    ruleCache.push(node);
}

exports.default = _postcss2.default.plugin('postcss-reduce-idents', function () {
    var _ref4 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    var _ref4$counter = _ref4.counter;
    var counter = _ref4$counter === undefined ? true : _ref4$counter;
    var _ref4$counterStyle = _ref4.counterStyle;
    var counterStyle = _ref4$counterStyle === undefined ? true : _ref4$counterStyle;
    var _ref4$encoder = _ref4.encoder;
    var encoder = _ref4$encoder === undefined ? _encode2.default : _ref4$encoder;
    var _ref4$keyframes = _ref4.keyframes;
    var keyframes = _ref4$keyframes === undefined ? true : _ref4$keyframes;

    return function (css) {
        // Encode at rule names and cache the result

        var counterCache = {
            cache: {},
            declOneCache: [],
            declTwoCache: []
        };
        var counterStyleCache = {
            cache: {},
            ruleCache: [],
            declCache: []
        };
        var keyframesCache = {
            cache: {},
            ruleCache: [],
            declCache: []
        };
        css.walk(function (node) {
            var name = node.name;
            var prop = node.prop;
            var type = node.type;

            if (type === 'atrule') {
                if (counterStyle && /counter-style/.test(name)) {
                    cacheAtRule(node, encoder, counterStyleCache);
                }
                if (keyframes && /keyframes/.test(name)) {
                    cacheAtRule(node, encoder, keyframesCache);
                }
            }
            if (type === 'decl') {
                if (counter) {
                    if (/counter-(reset|increment)/.test(prop)) {
                        node.value = (0, _postcssValueParser2.default)(node.value).walk(function (child) {
                            if (child.type === 'word' && !isNum(child)) {
                                addToCache(child.value, encoder, counterCache.cache);
                                child.value = counterCache.cache[child.value].ident;
                            } else if (child.type === 'space') {
                                child.value = ' ';
                            }
                        });
                        counterCache.declOneCache.push(node);
                    } else if (/content/.test(prop)) {
                        counterCache.declTwoCache.push(node);
                    }
                }
                if (counterStyle && /(list-style|system)/.test(prop)) {
                    counterStyleCache.declCache.push(node);
                }
                if (keyframes && /animation/.test(prop)) {
                    keyframesCache.declCache.push(node);
                }
            }
        });
        counter && transformDecl(counterCache);
        counterStyle && transformAtRule(counterStyleCache);
        keyframes && transformAtRule(keyframesCache);
    };
});
module.exports = exports['default'];