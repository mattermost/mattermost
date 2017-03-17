'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _postcss = require('postcss');

exports['default'] = function (v) {
    var s = typeof v === 'string' ? _postcss.list.space(v) : v;
    var value = [s[0], // top
    s[1] || s[0], // right
    s[2] || s[0], // bottom
    s[3] || s[1] || s[0] // left
    ];
    if (value[3] === value[1]) {
        value.pop();
        if (value[2] === value[0]) {
            value.pop();
            if (value[0] === value[1]) {
                value.pop();
            }
        }
    }
    return value.join(' ');
};

module.exports = exports['default'];