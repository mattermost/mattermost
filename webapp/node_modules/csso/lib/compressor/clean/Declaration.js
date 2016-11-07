module.exports = function cleanDeclartion(node, item, list) {
    if (node.value.sequence.isEmpty()) {
        list.remove(item);
    }
};
