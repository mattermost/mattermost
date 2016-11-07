'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _evenValues = require('./evenValues');

var _evenValues2 = _interopRequireDefault(_evenValues);

var _getArguments = require('./getArguments');

var _getArguments2 = _interopRequireDefault(_getArguments);

var _getMatch = require('./getMatch');

var _getMatch2 = _interopRequireDefault(_getMatch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var mappings = [['repeat-x', ['repeat', 'no-repeat']], ['repeat-y', ['no-repeat', 'repeat']], ['repeat', ['repeat', 'repeat']], ['space', ['space', 'space']], ['round', ['round', 'round']], ['no-repeat', ['no-repeat', 'no-repeat']]];

var repeat = [mappings[0][0], mappings[1][0], mappings[2][0], mappings[3][0], mappings[4][0], mappings[5][0]];

var getMatch = (0, _getMatch2.default)(mappings);

function transform(decl) {
    var values = (0, _postcssValueParser2.default)(decl.value);
    if (values.nodes.length === 1) {
        return;
    }
    var args = (0, _getArguments2.default)(values);
    var relevant = [];
    args.forEach(function (arg) {
        relevant.push({
            start: null,
            end: null
        });
        arg.forEach(function (part, index) {
            var isRepeat = ~repeat.indexOf(part.value);
            var len = relevant.length - 1;
            if (relevant[len].start === null && isRepeat) {
                relevant[len].start = index;
                relevant[len].end = index;
                return;
            }
            if (relevant[len].start !== null) {
                if (part.type === 'space') {
                    return;
                } else if (isRepeat) {
                    relevant[len].end = index;
                    return;
                }
                return;
            }
        });
    });
    relevant.forEach(function (range, index) {
        if (range.start === null) {
            return;
        }
        var val = args[index].slice(range.start, range.end + 1);
        if (val.length !== 3) {
            return;
        }
        var match = getMatch(val.filter(_evenValues2.default).map(function (n) {
            return n.value;
        }));
        if (match.length) {
            args[index][range.start].value = match[0][0];
            args[index][range.start + 1].value = '';
            args[index][range.end].value = '';
        }
    });
    decl.value = values.toString();
}

var plugin = _postcss2.default.plugin('cssnano-reduce-background-repeat', function () {
    return function (css) {
        return css.walkDecls(/background(-repeat|$)/, transform);
    };
});

plugin.mappings = mappings;

exports.default = plugin;
module.exports = exports['default'];