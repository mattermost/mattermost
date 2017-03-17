'use strict';

exports.__esModule = true;

exports.default = function (hex) {
    if (hex.length === 7 && hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) {
        return '#' + hex[2] + hex[4] + hex[6];
    }
    return hex;
};

module.exports = exports['default'];