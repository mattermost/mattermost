var translate = require('../../../utils/translate.js');
var specificity = require('./specificity.js');

var nonFreezePseudoElements = {
    'first-letter': true,
    'first-line': true,
    'after': true,
    'before': true
};
var nonFreezePseudoClasses = {
    'link': true,
    'visited': true,
    'hover': true,
    'active': true,
    'first-letter': true,
    'first-line': true,
    'after': true,
    'before': true
};

module.exports = function freeze(node, usageData) {
    var pseudos = Object.create(null);
    var hasPseudo = false;

    node.selector.selectors.each(function(simpleSelector) {
        var tagName = '*';
        var scope = 0;

        simpleSelector.sequence.some(function(node) {
            switch (node.type) {
                case 'Class':
                    if (usageData && usageData.scopes) {
                        var classScope = usageData.scopes[node.name] || 0;

                        if (scope !== 0 && classScope !== scope) {
                            throw new Error('Selector can\'t has classes from different scopes: ' + translate(simpleSelector));
                        }

                        scope = classScope;
                    }
                    break;

                case 'PseudoClass':
                    if (!nonFreezePseudoClasses.hasOwnProperty(node.name)) {
                        pseudos[node.name] = true;
                        hasPseudo = true;
                    }
                    break;

                case 'PseudoElement':
                    if (!nonFreezePseudoElements.hasOwnProperty(node.name)) {
                        pseudos[node.name] = true;
                        hasPseudo = true;
                    }
                    break;

                case 'FunctionalPseudo':
                    pseudos[node.name] = true;
                    hasPseudo = true;
                    break;

                case 'Negation':
                    pseudos.not = true;
                    hasPseudo = true;
                    break;

                case 'Identifier':
                    tagName = node.name;
                    break;

                case 'Attribute':
                    if (node.flags) {
                        pseudos['[' + node.flags + ']'] = true;
                        hasPseudo = true;
                    }
                    break;

                case 'Combinator':
                    tagName = '*';
                    break;
            }
        });

        simpleSelector.id = translate(simpleSelector);
        simpleSelector.compareMarker = specificity(simpleSelector).toString();

        if (scope) {
            simpleSelector.compareMarker += ':' + scope;
        }

        if (tagName !== '*') {
            simpleSelector.compareMarker += ',' + tagName;
        }
    });

    if (hasPseudo) {
        node.pseudoSignature = Object.keys(pseudos).sort().join(',');
    }
};
