module.exports = function(node) {
    node.block.rules.each(function(ruleset) {
        ruleset.selector.selectors.each(function(simpleselector) {
            simpleselector.sequence.each(function(data, item) {
                if (data.type === 'Percentage' && data.value === '100') {
                    item.data = {
                        type: 'Identifier',
                        info: data.info,
                        name: 'to'
                    };
                } else if (data.type === 'Identifier' && data.name === 'from') {
                    item.data = {
                        type: 'Percentage',
                        info: data.info,
                        value: '0'
                    };
                }
            });
        });
    });
};
