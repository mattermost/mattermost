var walkRulesRight = require('../../utils/walk.js').rulesRight;

function isMediaRule(node) {
    return node.type === 'Atrule' && node.name === 'media';
}

function processAtrule(node, item, list) {
    if (!isMediaRule(node)) {
        return;
    }

    var prev = item.prev && item.prev.data;

    if (!prev || !isMediaRule(prev)) {
        return;
    }

    // merge @media with same query
    if (node.expression.id === prev.expression.id) {
        prev.block.rules.appendList(node.block.rules);
        prev.info = {
            primary: prev.info,
            merged: node.info
        };
        list.remove(item);
    }
};

module.exports = function rejoinAtrule(ast) {
    walkRulesRight(ast, function(node, item, list) {
        if (node.type === 'Atrule') {
            processAtrule(node, item, list);
        }
    });
};
