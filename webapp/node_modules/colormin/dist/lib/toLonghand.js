'use strict';

exports.__esModule = true;

exports.default = function (hex) {
    if (hex.length !== 4) {
        return hex;
    }

    var r = hex[1];
    var g = hex[2];
    var b = hex[3];
    return '#' + r + r + g + g + b + b;
};

module.exports = exports['default'];