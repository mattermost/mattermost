function packNumber(value) {
    // 100 -> '100'
    // 00100 -> '100'
    // +100 -> '100'
    // -100 -> '-100'
    // 0.123 -> '.123'
    // 0.12300 -> '.123'
    // 0.0 -> ''
    // 0 -> ''
    value = String(value).replace(/^(?:\+|(-))?0*(\d*)(?:\.0*|(\.\d*?)0*)?$/, '$1$2$3');

    if (value.length === 0 || value === '-') {
        value = '0';
    }

    return value;
};

module.exports = function(node) {
    node.value = packNumber(node.value);
};
module.exports.pack = packNumber;
