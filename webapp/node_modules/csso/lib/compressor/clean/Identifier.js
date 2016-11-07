module.exports = function cleanIdentifier(node, item, list) {
    // remove useless universal selector
    if (this.selector !== null && node.name === '*') {
        // remove when universal selector isn't last
        if (item.next && item.next.data.type !== 'Combinator') {
            list.remove(item);
        }
    }
};
