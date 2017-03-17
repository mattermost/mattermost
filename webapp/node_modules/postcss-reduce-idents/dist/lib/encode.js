'use strict';

exports.__esModule = true;
exports.default = encode;
function encode(val, num) {
    var base = 52;
    var characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var character = num % base;
    var result = characters[character];
    var remainder = Math.floor(num / base);
    if (remainder) {
        base = 64;
        characters = characters + '0123456789-_';
        while (remainder) {
            character = remainder % base;
            remainder = Math.floor(remainder / base);
            result = result + characters[character];
        }
    }
    return result;
};
module.exports = exports['default'];