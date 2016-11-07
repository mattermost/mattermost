'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _postcss = require('postcss');

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _has = require('has');

var _has2 = _interopRequireDefault(_has);

var _getArguments = require('./getArguments');

var _getArguments2 = _interopRequireDefault(_getArguments);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var directions = ['top', 'right', 'bottom', 'left', 'center'];
var properties = ['background', 'background-position', '-webkit-perspective-origin', 'perspective-origin'];

var center = '50%';

var horizontal = {
    right: '100%',
    left: '0'
};

var vertical = {
    bottom: '100%',
    top: '0'
};

function transform(decl) {
    if (!~properties.indexOf(decl.prop)) {
        return;
    }
    var values = (0, _postcssValueParser2.default)(decl.value);
    var args = (0, _getArguments2.default)(values);
    var relevant = [];
    args.forEach(function (arg) {
        relevant.push({
            start: null,
            end: null
        });
        arg.forEach(function (part, index) {
            var isPosition = ~directions.indexOf(part.value) || (0, _postcssValueParser.unit)(part.value);
            var len = relevant.length - 1;
            if (relevant[len].start === null && isPosition) {
                relevant[len].start = index;
                relevant[len].end = index;
                return;
            }
            if (relevant[len].start !== null) {
                if (part.type === 'space') {
                    return;
                } else if (isPosition) {
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
        var position = args[index].slice(range.start, range.end + 1);
        if (position.length > 3) {
            return;
        }
        if (position.length === 1 || position[2].value === 'center') {
            if (position[2]) {
                position[2].value = position[1].value = '';
            }
            var value = position[0].value;

            var map = _extends({}, horizontal, {
                center: center
            });
            if ((0, _has2.default)(map, value)) {
                position[0].value = map[value];
            }
            return;
        }
        if (position[0].value === 'center' && ~directions.indexOf(position[2].value)) {
            position[0].value = position[1].value = '';
            var _value = position[2].value;

            if ((0, _has2.default)(horizontal, _value)) {
                position[2].value = horizontal[_value];
            }
            return;
        }
        if ((0, _has2.default)(horizontal, position[0].value) && (0, _has2.default)(vertical, position[2].value)) {
            position[0].value = horizontal[position[0].value];
            position[2].value = vertical[position[2].value];
            return;
        } else if ((0, _has2.default)(vertical, position[0].value) && (0, _has2.default)(horizontal, position[2].value)) {
            var first = position[0].value;
            position[0].value = horizontal[position[2].value];
            position[2].value = vertical[first];
            return;
        }
    });
    decl.value = values.toString();
}

exports.default = (0, _postcss.plugin)('cssnano-reduce-positions', function () {
    return function (css) {
        return css.walkDecls(transform);
    };
});
module.exports = exports['default'];