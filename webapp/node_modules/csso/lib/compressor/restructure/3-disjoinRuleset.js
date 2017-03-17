var List = require('../../utils/list.js');
var walkRulesRight = require('../../utils/walk.js').rulesRight;

function processRuleset(node, item, list) {
    var selectors = node.selector.selectors;

    // generate new rule sets:
    // .a, .b { color: red; }
    // ->
    // .a { color: red; }
    // .b { color: red; }

    // while there are more than 1 simple selector split for rulesets
    while (selectors.head !== selectors.tail) {
        var newSelectors = new List();
        newSelectors.insert(selectors.remove(selectors.head));

        list.insert(list.createItem({
            type: 'Ruleset',
            info: node.info,
            pseudoSignature: node.pseudoSignature,
            selector: {
                type: 'Selector',
                info: node.selector.info,
                selectors: newSelectors
            },
            block: {
                type: 'Block',
                info: node.block.info,
                declarations: node.block.declarations.copy()
            }
        }), item);
    }
};

module.exports = function disjoinRuleset(ast) {
    walkRulesRight(ast, function(node, item, list) {
        if (node.type === 'Ruleset') {
            processRuleset(node, item, list);
        }
    });
};
