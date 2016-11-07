var translate = require('../../../utils/translate.js');

function Index() {
    this.seed = 0;
    this.map = Object.create(null);
}

Index.prototype.resolve = function(str) {
    var index = this.map[str];

    if (!index) {
        index = ++this.seed;
        this.map[str] = index;
    }

    return index;
};

module.exports = function createDeclarationIndexer() {
    var names = new Index();
    var values = new Index();

    return function markDeclaration(node) {
        var property = node.property.name;
        var value = translate(node.value);

        node.id = names.resolve(property) + (values.resolve(value) << 12);
        node.length = property.length + 1 + value.length;

        return node;
    };
};
