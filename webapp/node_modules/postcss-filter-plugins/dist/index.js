'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _uniqid = require('uniqid');

var _uniqid2 = _interopRequireDefault(_uniqid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _postcss2.default.plugin('postcss-filter-plugins', function () {
    var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    var _ref$template = _ref.template;
    var template = _ref$template === undefined ? function (_ref2) {
        var postcssPlugin = _ref2.postcssPlugin;
        return 'Found duplicate plugin: ' + postcssPlugin;
    } : _ref$template;
    var _ref$silent = _ref.silent;
    var silent = _ref$silent === undefined ? false : _ref$silent;
    var _ref$exclude = _ref.exclude;
    var exclude = _ref$exclude === undefined ? [] : _ref$exclude;
    var _ref$direction = _ref.direction;
    var direction = _ref$direction === undefined ? 'both' : _ref$direction;

    var id = (0, _uniqid2.default)();
    var prev = void 0,
        next = void 0,
        both = void 0;

    switch (direction) {
        case 'both':
            both = true;
            break;
        case 'backward':
            prev = true;
            break;
        case 'forward':
            next = true;
            break;
    }

    var processor = function processor(css, result) {
        var previousPlugins = [];
        var nextPlugins = [];
        var bothPlugins = [];
        var filter = false;
        var position = 0;

        var detect = function detect(list, plugin) {
            var name = plugin.postcssPlugin;
            if (typeof name === 'undefined') {
                position++;
                return;
            }
            if (~list.indexOf(name)) {
                if (!silent) {
                    result.warn(template(plugin));
                }
                result.processor.plugins.splice(position, 1);
            } else {
                list.push(name);
                position++;
            }
        };

        while (position < result.processor.plugins.length) {
            var plugin = result.processor.plugins[position];
            if (~exclude.indexOf(plugin.postcssPlugin)) {
                position++;
                continue;
            }
            if (plugin._id === id) {
                position++;
                filter = true;
                continue;
            } else if (plugin.postcssPlugin === 'postcss-filter-plugins') {
                position++;
                continue;
            }
            if (both) {
                detect(bothPlugins, plugin);
                continue;
            }
            if (filter && next) {
                detect(nextPlugins, plugin);
                continue;
            }
            if (!filter && prev) {
                detect(previousPlugins, plugin);
                continue;
            }
            position++;
        }
    };

    processor._id = id;

    return processor;
});
module.exports = exports['default'];