function walkRules(node, item, list) {
    switch (node.type) {
        case 'StyleSheet':
            var oldStylesheet = this.stylesheet;
            this.stylesheet = node;

            node.rules.each(walkRules, this);

            this.stylesheet = oldStylesheet;
            break;

        case 'Atrule':
            if (node.block !== null) {
                walkRules.call(this, node.block);
            }

            this.fn(node, item, list);
            break;

        case 'Ruleset':
            this.fn(node, item, list);
            break;
    }

}

function walkRulesRight(node, item, list) {
    switch (node.type) {
        case 'StyleSheet':
            var oldStylesheet = this.stylesheet;
            this.stylesheet = node;

            node.rules.eachRight(walkRulesRight, this);

            this.stylesheet = oldStylesheet;
            break;

        case 'Atrule':
            if (node.block !== null) {
                walkRulesRight.call(this, node.block);
            }

            this.fn(node, item, list);
            break;

        case 'Ruleset':
            this.fn(node, item, list);
            break;
    }
}

function walkAll(node, item, list) {
    switch (node.type) {
        case 'StyleSheet':
            var oldStylesheet = this.stylesheet;
            this.stylesheet = node;

            node.rules.each(walkAll, this);

            this.stylesheet = oldStylesheet;
            break;

        case 'Atrule':
            if (node.expression !== null) {
                walkAll.call(this, node.expression);
            }
            if (node.block !== null) {
                walkAll.call(this, node.block);
            }
            break;

        case 'Ruleset':
            this.ruleset = node;

            if (node.selector !== null) {
                walkAll.call(this, node.selector);
            }
            walkAll.call(this, node.block);

            this.ruleset = null;
            break;

        case 'Selector':
            var oldSelector = this.selector;
            this.selector = node;

            node.selectors.each(walkAll, this);

            this.selector = oldSelector;
            break;

        case 'Block':
            node.declarations.each(walkAll, this);
            break;

        case 'Declaration':
            this.declaration = node;

            walkAll.call(this, node.property);
            walkAll.call(this, node.value);

            this.declaration = null;
            break;

        case 'Attribute':
            walkAll.call(this, node.name);
            if (node.value !== null) {
                walkAll.call(this, node.value);
            }
            break;

        case 'FunctionalPseudo':
        case 'Function':
            this['function'] = node;

            node.arguments.each(walkAll, this);

            this['function'] = null;
            break;

        case 'AtruleExpression':
            this.atruleExpression = node;

            node.sequence.each(walkAll, this);

            this.atruleExpression = null;
            break;

        case 'Value':
        case 'Argument':
        case 'SimpleSelector':
        case 'Braces':
        case 'Negation':
            node.sequence.each(walkAll, this);
            break;

        case 'Url':
        case 'Progid':
            walkAll.call(this, node.value);
            break;

        // nothig to do with
        // case 'Property':
        // case 'Combinator':
        // case 'Dimension':
        // case 'Hash':
        // case 'Identifier':
        // case 'Nth':
        // case 'Class':
        // case 'Id':
        // case 'Percentage':
        // case 'PseudoClass':
        // case 'PseudoElement':
        // case 'Space':
        // case 'Number':
        // case 'String':
        // case 'Operator':
        // case 'Raw':
    }

    this.fn(node, item, list);
}

function createContext(root, fn) {
    var context = {
        fn: fn,
        root: root,
        stylesheet: null,
        atruleExpression: null,
        ruleset: null,
        selector: null,
        declaration: null,
        function: null
    };

    return context;
}

module.exports = {
    all: function(root, fn) {
        walkAll.call(createContext(root, fn), root);
    },
    rules: function(root, fn) {
        walkRules.call(createContext(root, fn), root);
    },
    rulesRight: function(root, fn) {
        walkRulesRight.call(createContext(root, fn), root);
    }
};
