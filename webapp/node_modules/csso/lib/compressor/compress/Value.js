var resolveName = require('../../utils/names.js').property;
var handlers = {
    'font': require('./property/font.js'),
    'font-weight': require('./property/font-weight.js'),
    'background': require('./property/background.js')
};

module.exports = function compressValue(node) {
    if (!this.declaration) {
        return;
    }

    var property = resolveName(this.declaration.property.name);

    if (handlers.hasOwnProperty(property.name)) {
        handlers[property.name](node);
    }
};
