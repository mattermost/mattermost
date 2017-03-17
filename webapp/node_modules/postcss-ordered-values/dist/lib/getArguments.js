'use strict';

exports.__esModule = true;
exports.default = getArguments;
function getArguments(node) {
    return node.nodes.reduce(function (list, child) {
        if (child.type !== 'div' || child.value !== ',') {
            list[list.length - 1].push(child);
        } else {
            list.push([]);
        }
        return list;
    }, [[]]);
}
module.exports = exports['default'];