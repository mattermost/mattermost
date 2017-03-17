var hasOwnProperty = Object.prototype.hasOwnProperty;

function cleanUnused(node, usageData) {
    return node.selector.selectors.each(function(selector, item, list) {
        var hasUnused = selector.sequence.some(function(node) {
            switch (node.type) {
                case 'Class':
                    return usageData.classes && !hasOwnProperty.call(usageData.classes, node.name);

                case 'Id':
                    return usageData.ids && !hasOwnProperty.call(usageData.ids, node.name);

                case 'Identifier':
                    // ignore universal selector
                    if (node.name !== '*') {
                        // TODO: remove toLowerCase when type selectors will be normalized
                        return usageData.tags && !hasOwnProperty.call(usageData.tags, node.name.toLowerCase());
                    }

                    break;
            }
        });

        if (hasUnused) {
            list.remove(item);
        }
    });
}

module.exports = function cleanRuleset(node, item, list, usageData) {
    if (usageData) {
        cleanUnused(node, usageData);
    }

    if (node.selector.selectors.isEmpty() ||
        node.block.declarations.isEmpty()) {
        list.remove(item);
    }
};
