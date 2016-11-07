var unit = require('postcss-value-parser').unit;
var keywords = require('./keywords');
var minifyFamily = require('./minify-family');
var minifyWeight = require('./minify-weight');

module.exports = function (nodes, opts) {
    var i, max, node, familyStart, family;
    var hasSize = false;

    for (i = 0, max = nodes.length; i < max; i += 1) {
        node = nodes[i];
        if (node.type === 'word') {
            if (node.value === 'normal' ||
                ~keywords.style.indexOf(node.value) ||
                ~keywords.variant.indexOf(node.value) ||
                ~keywords.stretch.indexOf(node.value)) {
                if (!hasSize) {
                    familyStart = i;
                }
            } else if (~keywords.weight.indexOf(node.value)) {
                if (!hasSize) {
                    node.value = minifyWeight(node.value, opts);
                    familyStart = i;
                }
            } else if (~keywords.size.indexOf(node.value) || unit(node.value)) {
                if (!hasSize) {
                    familyStart = i;
                    hasSize = true;
                }
            }
        } else if (node.type === 'div') {
            node.before = '';
            node.after = '';
            if (node.value === '/') {
                familyStart = i + 1;
            }
            break;
        } else if (node.type === 'space') {
            node.value = ' ';
        }
    }

    if (!isNaN(familyStart)) {
        familyStart += 2;
        family = minifyFamily(nodes.slice(familyStart), opts);
        nodes = nodes.slice(0, familyStart).concat(family);
    }

    return nodes;
};
