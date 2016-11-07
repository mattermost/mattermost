var SourceMapGenerator = require('source-map').SourceMapGenerator;
var SourceNode = require('source-map').SourceNode;

// Our own implementation of SourceNode#toStringWithSourceMap,
// since SourceNode doesn't allow multiple references to original source.
// Also, as we know structure of result we could be optimize generation
// (currently it's ~40% faster).
function walk(node, fn) {
    for (var chunk, i = 0; i < node.children.length; i++) {
        chunk = node.children[i];

        if (chunk instanceof SourceNode) {
            // this is a hack, because source maps doesn't support for 1(generated):N(original)
            // if (chunk.merged) {
            //     fn('', chunk);
            // }

            walk(chunk, fn);
        } else {
            fn(chunk, node);
        }
    }
}

function generateSourceMap(root) {
    var map = new SourceMapGenerator();
    var css = '';
    var sourceMappingActive = false;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastIndexOfNewline;
    var generated = {
        line: 1,
        column: 0
    };
    var activatedMapping = {
        generated: generated
    };

    walk(root, function(chunk, original) {
        if (original.line !== null &&
            original.column !== null) {
            if (lastOriginalLine !== original.line ||
                lastOriginalColumn !== original.column) {
                map.addMapping({
                    source: original.source,
                    original: original,
                    generated: generated
                });
            }

            lastOriginalLine = original.line;
            lastOriginalColumn = original.column;
            sourceMappingActive = true;
        } else if (sourceMappingActive) {
            map.addMapping(activatedMapping);
            sourceMappingActive = false;
        }

        css += chunk;

        lastIndexOfNewline = chunk.lastIndexOf('\n');
        if (lastIndexOfNewline !== -1) {
            generated.line += chunk.match(/\n/g).length;
            generated.column = chunk.length - lastIndexOfNewline - 1;
        } else {
            generated.column += chunk.length;
        }
    });

    return {
        css: css,
        map: map
    };
}

function createAnonymousSourceNode(children) {
    return new SourceNode(
        null,
        null,
        null,
        children
    );
}

function createSourceNode(info, children) {
    if (info.primary) {
        // special marker node to add several references to original
        // var merged = createSourceNode(info.merged, []);
        // merged.merged = true;
        // children.unshift(merged);

        // use recursion, because primary can also has a primary/merged info
        return createSourceNode(info.primary, children);
    }

    return new SourceNode(
        info.line,
        info.column - 1,
        info.source,
        children
    );
}

function each(list) {
    if (list.head === null) {
        return '';
    }

    if (list.head === list.tail) {
        return translate(list.head.data);
    }

    return list.map(translate).join('');
}

function eachDelim(list, delimeter) {
    if (list.head === null) {
        return '';
    }

    if (list.head === list.tail) {
        return translate(list.head.data);
    }

    return list.map(translate).join(delimeter);
}

function translate(node) {
    switch (node.type) {
        case 'StyleSheet':
            return createAnonymousSourceNode(node.rules.map(translate));

        case 'Atrule':
            var nodes = ['@', node.name];

            if (node.expression && !node.expression.sequence.isEmpty()) {
                nodes.push(' ', translate(node.expression));
            }

            if (node.block) {
                nodes.push('{', translate(node.block), '}');
            } else {
                nodes.push(';');
            }

            return createSourceNode(node.info, nodes);

        case 'Ruleset':
            return createAnonymousSourceNode([
                translate(node.selector), '{', translate(node.block), '}'
            ]);

        case 'Selector':
            return createAnonymousSourceNode(node.selectors.map(translate)).join(',');

        case 'SimpleSelector':
            var nodes = node.sequence.map(function(node) {
                // add extra spaces around /deep/ combinator since comment beginning/ending may to be produced
                if (node.type === 'Combinator' && node.name === '/deep/') {
                    return ' ' + translate(node) + ' ';
                }

                return translate(node);
            });

            return createSourceNode(node.info, nodes);

        case 'Block':
            return createAnonymousSourceNode(node.declarations.map(translate)).join(';');

        case 'Declaration':
            return createSourceNode(
                node.info,
                [translate(node.property), ':', translate(node.value)]
            );

        case 'Property':
            return node.name;

        case 'Value':
            return node.important
                ? each(node.sequence) + '!important'
                : each(node.sequence);

        case 'Attribute':
            var result = translate(node.name);
            var flagsPrefix = ' ';

            if (node.operator !== null) {
                result += node.operator;

                if (node.value !== null) {
                    result += translate(node.value);

                    // space between string and flags is not required
                    if (node.value.type === 'String') {
                        flagsPrefix = '';
                    }
                }
            }

            if (node.flags !== null) {
                result += flagsPrefix + node.flags;
            }

            return '[' + result + ']';

        case 'FunctionalPseudo':
            return ':' + node.name + '(' + eachDelim(node.arguments, ',') + ')';

        case 'Function':
            return node.name + '(' + eachDelim(node.arguments, ',') + ')';

        case 'Negation':
            return ':not(' + eachDelim(node.sequence, ',') + ')';

        case 'Braces':
            return node.open + each(node.sequence) + node.close;

        case 'Argument':
        case 'AtruleExpression':
            return each(node.sequence);

        case 'Url':
            return 'url(' + translate(node.value) + ')';

        case 'Progid':
            return translate(node.value);

        case 'Combinator':
            return node.name;

        case 'Identifier':
            return node.name;

        case 'PseudoClass':
            return ':' + node.name;

        case 'PseudoElement':
            return '::' + node.name;

        case 'Class':
            return '.' + node.name;

        case 'Id':
            return '#' + node.name;

        case 'Hash':
            return '#' + node.value;

        case 'Dimension':
            return node.value + node.unit;

        case 'Nth':
            return node.value;

        case 'Number':
            return node.value;

        case 'String':
            return node.value;

        case 'Operator':
            return node.value;

        case 'Raw':
            return node.value;

        case 'Unknown':
            return node.value;

        case 'Percentage':
            return node.value + '%';

        case 'Space':
            return ' ';

        case 'Comment':
            return '/*' + node.value + '*/';

        default:
            throw new Error('Unknown node type: ' + node.type);
    }
}

module.exports = function(node) {
    return generateSourceMap(
        createAnonymousSourceNode(translate(node))
    );
};
