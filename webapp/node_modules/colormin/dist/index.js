'use strict';

exports.__esModule = true;

var _color = require('color');

var _color2 = _interopRequireDefault(_color);

var _colourNames = require('./lib/colourNames');

var _colourNames2 = _interopRequireDefault(_colourNames);

var _toShorthand = require('./lib/toShorthand');

var _toShorthand2 = _interopRequireDefault(_toShorthand);

var _colourType = require('./lib/colourType');

var ctype = _interopRequireWildcard(_colourType);

var _stripWhitespace = require('./lib/stripWhitespace');

var _stripWhitespace2 = _interopRequireDefault(_stripWhitespace);

var _trimLeadingZero = require('./lib/trimLeadingZero');

var _trimLeadingZero2 = _interopRequireDefault(_trimLeadingZero);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var filterColor = function filterColor(callback) {
    return Object.keys(_colourNames2.default).filter(callback);
};
var shorter = function shorter(a, b) {
    return (a && a.length < b.length ? a : b).toLowerCase();
};

exports.default = function (colour) {
    var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    if (ctype.isRGBorHSL(colour)) {
        var c = void 0;
        // Pass through invalid rgb/hsl functions
        try {
            c = (0, _color2.default)(colour);
        } catch (err) {
            return colour;
        }
        if (c.alpha() === 1) {
            // At full alpha, just use hex
            colour = c.hexString();
        } else {
            var rgb = c.rgb();
            if (!opts.legacy && !rgb.r && !rgb.g && !rgb.b && !rgb.a) {
                return 'transparent';
            }
            var hsla = c.hslaString();
            var rgba = c.rgbString();
            return (0, _trimLeadingZero2.default)((0, _stripWhitespace2.default)(hsla.length < rgba.length ? hsla : rgba));
        }
    }
    if (ctype.isHex(colour)) {
        colour = (0, _toShorthand2.default)(colour.toLowerCase());
        var keyword = filterColor(function (key) {
            return _colourNames2.default[key] === colour;
        })[0];
        return shorter(keyword, colour);
    } else if (ctype.isKeyword(colour)) {
        var hex = _colourNames2.default[filterColor(function (k) {
            return k === colour.toLowerCase();
        })[0]];
        return shorter(hex, colour);
    }
    // Possibly malformed, just pass through
    return colour;
};

module.exports = exports['default'];