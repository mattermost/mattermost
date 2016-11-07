module.exports = function specificity(simpleSelector) {
    var A = 0;
    var B = 0;
    var C = 0;

    simpleSelector.sequence.each(function walk(data) {
        switch (data.type) {
            case 'SimpleSelector':
            case 'Negation':
                data.sequence.each(walk);
                break;

            case 'Id':
                A++;
                break;

            case 'Class':
            case 'Attribute':
            case 'FunctionalPseudo':
                B++;
                break;

            case 'Identifier':
                if (data.name !== '*') {
                    C++;
                }
                break;

            case 'PseudoElement':
                C++;
                break;

            case 'PseudoClass':
                var name = data.name.toLowerCase();
                if (name === 'before' ||
                    name === 'after' ||
                    name === 'first-line' ||
                    name === 'first-letter') {
                    C++;
                } else {
                    B++;
                }
                break;
        }
    });

    return [A, B, C];
};
