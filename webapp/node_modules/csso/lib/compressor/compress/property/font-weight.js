module.exports = function compressFontWeight(node) {
    var value = node.sequence.head.data;

    if (value.type === 'Identifier') {
        switch (value.name) {
            case 'normal':
                node.sequence.head.data = {
                    type: 'Number',
                    info: value.info,
                    value: '400'
                };
                break;
            case 'bold':
                node.sequence.head.data = {
                    type: 'Number',
                    info: value.info,
                    value: '700'
                };
                break;
        }
    }
};
