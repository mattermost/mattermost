function canCleanWhitespace(node) {
    if (node.type !== 'Operator') {
        return false;
    }

    return node.value !== '+' && node.value !== '-';
}

module.exports = function cleanWhitespace(node, item, list) {
    var prev = item.prev && item.prev.data;
    var next = item.next && item.next.data;

    if (canCleanWhitespace(prev) || canCleanWhitespace(next)) {
        list.remove(item);
    }
};
