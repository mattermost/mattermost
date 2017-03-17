'use strict';

exports.__esModule = true;
exports.default = getValue;

var _postcssValueParser = require('postcss-value-parser');

function getValue(values) {
    return (0, _postcssValueParser.stringify)({
        nodes: values.reduce(function (nodes, arg, index) {
            arg.forEach(function (val, idx) {
                if (idx === arg.length - 1 && index === values.length - 1 && val.type === 'space') {
                    return;
                }
                nodes.push(val);
            });
            if (index !== values.length - 1) {
                if (nodes[nodes.length - 1] && nodes[nodes.length - 1].type === 'space') {
                    nodes[nodes.length - 1].type = 'div';
                    nodes[nodes.length - 1].value = ',';
                    return nodes;
                }
                nodes.push({ type: 'div', value: ',' });
            }
            return nodes;
        }, [])
    });
}
module.exports = exports['default'];