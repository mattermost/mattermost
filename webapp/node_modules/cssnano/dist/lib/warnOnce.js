'use strict';

exports.__esModule = true;
exports.default = warnOnce;
var messages = {};

function warnOnce(message) {
    if (messages[message]) {
        return;
    }
    messages[message] = true;
    if (typeof console !== 'undefined' && console.warn) {
        console.warn(message);
    }
}
module.exports = exports['default'];