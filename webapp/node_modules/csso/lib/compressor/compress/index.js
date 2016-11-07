var walk = require('../../utils/walk.js').all;
var handlers = {
    Atrule: require('./Atrule.js'),
    Attribute: require('./Attribute.js'),
    Value: require('./Value.js'),
    Dimension: require('./Dimension.js'),
    Percentage: require('./Number.js'),
    Number: require('./Number.js'),
    String: require('./String.js'),
    Url: require('./Url.js'),
    Hash: require('./color.js').compressHex,
    Identifier: require('./color.js').compressIdent,
    Function: require('./color.js').compressFunction
};

module.exports = function(ast) {
    walk(ast, function(node, item, list) {
        if (handlers.hasOwnProperty(node.type)) {
            handlers[node.type].call(this, node, item, list);
        }
    });
};
