'use strict';

var TokenType = require('./const').TokenType;
var Scanner = require('./scanner');
var List = require('../utils/list');
var needPositions;
var filename;
var scanner;

var SCOPE_ATRULE_EXPRESSION = 1;
var SCOPE_SELECTOR = 2;
var SCOPE_VALUE = 3;

var specialFunctions = {};
specialFunctions[SCOPE_ATRULE_EXPRESSION] = {
    url: getUri
};
specialFunctions[SCOPE_SELECTOR] = {
    url: getUri,
    not: getNotFunction
};
specialFunctions[SCOPE_VALUE] = {
    url: getUri,
    expression: getOldIEExpression,
    var: getVarFunction
};

var initialContext = {
    stylesheet: getStylesheet,
    atrule: getAtrule,
    atruleExpression: getAtruleExpression,
    ruleset: getRuleset,
    selector: getSelector,
    simpleSelector: getSimpleSelector,
    block: getBlock,
    declaration: getDeclaration,
    value: getValue
};

var blockMode = {
    'declaration': true,
    'property': true
};

function parseError(message) {
    var error = new Error(message);
    var offset = 0;
    var line = 1;
    var column = 1;
    var lines;

    if (scanner.token !== null) {
        offset = scanner.token.offset;
        line = scanner.token.line;
        column = scanner.token.column;
    } else if (scanner.prevToken !== null) {
        lines = scanner.prevToken.value.trimRight();
        offset = scanner.prevToken.offset + lines.length;
        lines = lines.split(/\n|\r\n?|\f/);
        line = scanner.prevToken.line + lines.length - 1;
        column = lines.length > 1
            ? lines[lines.length - 1].length + 1
            : scanner.prevToken.column + lines[lines.length - 1].length;
    }

    error.name = 'CssSyntaxError';
    error.parseError = {
        offset: offset,
        line: line,
        column: column
    };

    throw error;
}

function eat(tokenType) {
    if (scanner.token !== null && scanner.token.type === tokenType) {
        scanner.next();
        return true;
    }

    parseError(tokenType + ' is expected');
}

function expectIdentifier(name, eat) {
    if (scanner.token !== null) {
        if (scanner.token.type === TokenType.Identifier &&
            scanner.token.value.toLowerCase() === name) {
            if (eat) {
                scanner.next();
            }

            return true;
        }
    }

    parseError('Identifier `' + name + '` is expected');
}

function expectAny(what) {
    if (scanner.token !== null) {
        for (var i = 1, type = scanner.token.type; i < arguments.length; i++) {
            if (type === arguments[i]) {
                return true;
            }
        }
    }

    parseError(what + ' is expected');
}

function getInfo() {
    if (needPositions && scanner.token) {
        return {
            source: filename,
            offset: scanner.token.offset,
            line: scanner.token.line,
            column: scanner.token.column
        };
    }

    return null;

}

function removeTrailingSpaces(list) {
    while (list.tail) {
        if (list.tail.data.type === 'Space') {
            list.remove(list.tail);
        } else {
            break;
        }
    }
}

function getStylesheet(nested) {
    var child = null;
    var node = {
        type: 'StyleSheet',
        info: getInfo(),
        rules: new List()
    };

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.Space:
                scanner.next();
                child = null;
                break;

            case TokenType.Comment:
                // ignore comments except exclamation comments on top level
                if (nested || scanner.token.value.charAt(2) !== '!') {
                    scanner.next();
                    child = null;
                } else {
                    child = getComment();
                }
                break;

            case TokenType.Unknown:
                child = getUnknown();
                break;

            case TokenType.CommercialAt:
                child = getAtrule();
                break;

            case TokenType.RightCurlyBracket:
                if (!nested) {
                    parseError('Unexpected right curly brace');
                }

                break scan;

            default:
                child = getRuleset();
        }

        if (child !== null) {
            node.rules.insert(List.createItem(child));
        }
    }

    return node;
}

// '//' ...
// TODO: remove it as wrong thing
function getUnknown() {
    var info = getInfo();
    var value = scanner.token.value;

    eat(TokenType.Unknown);

    return {
        type: 'Unknown',
        info: info,
        value: value
    };
}

function isBlockAtrule() {
    for (var offset = 1, cursor; cursor = scanner.lookup(offset); offset++) {
        var type = cursor.type;

        if (type === TokenType.RightCurlyBracket) {
            return true;
        }

        if (type === TokenType.LeftCurlyBracket ||
            type === TokenType.CommercialAt) {
            return false;
        }
    }

    return true;
}

function getAtruleExpression() {
    var child = null;
    var node = {
        type: 'AtruleExpression',
        info: getInfo(),
        sequence: new List()
    };

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.Semicolon:
                break scan;

            case TokenType.LeftCurlyBracket:
                break scan;

            case TokenType.Space:
                if (node.sequence.isEmpty()) {
                    scanner.next(); // ignore spaces in beginning
                    child = null;
                } else {
                    child = getS();
                }
                break;

            case TokenType.Comment: // ignore comments
                scanner.next();
                child = null;
                break;

            case TokenType.Comma:
                child = getOperator();
                break;

            case TokenType.Colon:
                child = getPseudo();
                break;

            case TokenType.LeftParenthesis:
                child = getBraces(SCOPE_ATRULE_EXPRESSION);
                break;

            default:
                child = getAny(SCOPE_ATRULE_EXPRESSION);
        }

        if (child !== null) {
            node.sequence.insert(List.createItem(child));
        }
    }

    removeTrailingSpaces(node.sequence);

    return node;
}

function getAtrule() {
    eat(TokenType.CommercialAt);

    var node = {
        type: 'Atrule',
        info: getInfo(),
        name: readIdent(false),
        expression: getAtruleExpression(),
        block: null
    };

    if (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.Semicolon:
                scanner.next();  // {
                break;

            case TokenType.LeftCurlyBracket:
                scanner.next();  // {

                if (isBlockAtrule()) {
                    node.block = getBlock();
                } else {
                    node.block = getStylesheet(true);
                }

                eat(TokenType.RightCurlyBracket);
                break;

            default:
                parseError('Unexpected input');
        }
    }

    return node;
}

function getRuleset() {
    return {
        type: 'Ruleset',
        info: getInfo(),
        selector: getSelector(),
        block: getBlockWithBrackets()
    };
}

function getSelector() {
    var isBadSelector = false;
    var lastComma = true;
    var node = {
        type: 'Selector',
        info: getInfo(),
        selectors: new List()
    };

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.LeftCurlyBracket:
                break scan;

            case TokenType.Comma:
                if (lastComma) {
                    isBadSelector = true;
                }

                lastComma = true;
                scanner.next();
                break;

            default:
                if (!lastComma) {
                    isBadSelector = true;
                }

                lastComma = false;
                node.selectors.insert(List.createItem(getSimpleSelector()));

                if (node.selectors.tail.data.sequence.isEmpty()) {
                    isBadSelector = true;
                }
        }
    }

    if (lastComma) {
        isBadSelector = true;
        // parseError('Unexpected trailing comma');
    }

    if (isBadSelector) {
        node.selectors = new List();
    }

    return node;
}

function getSimpleSelector(nested) {
    var child = null;
    var combinator = null;
    var node = {
        type: 'SimpleSelector',
        info: getInfo(),
        sequence: new List()
    };

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.Comma:
                break scan;

            case TokenType.LeftCurlyBracket:
                if (nested) {
                    parseError('Unexpected input');
                }

                break scan;

            case TokenType.RightParenthesis:
                if (!nested) {
                    parseError('Unexpected input');
                }

                break scan;

            case TokenType.Comment:
                scanner.next();
                child = null;
                break;

            case TokenType.Space:
                child = null;
                if (!combinator && node.sequence.head) {
                    combinator = getCombinator();
                } else {
                    scanner.next();
                }
                break;

            case TokenType.PlusSign:
            case TokenType.GreaterThanSign:
            case TokenType.Tilde:
            case TokenType.Solidus:
                if (combinator && combinator.name !== ' ') {
                    parseError('Unexpected combinator');
                }

                child = null;
                combinator = getCombinator();
                break;

            case TokenType.FullStop:
                child = getClass();
                break;

            case TokenType.LeftSquareBracket:
                child = getAttribute();
                break;

            case TokenType.NumberSign:
                child = getShash();
                break;

            case TokenType.Colon:
                child = getPseudo();
                break;

            case TokenType.LowLine:
            case TokenType.Identifier:
            case TokenType.Asterisk:
                child = getNamespacedIdentifier(false);
                break;

            case TokenType.HyphenMinus:
            case TokenType.DecimalNumber:
                child = tryGetPercentage() || getNamespacedIdentifier(false);
                break;

            default:
                parseError('Unexpected input');
        }

        if (child !== null) {
            if (combinator !== null) {
                node.sequence.insert(List.createItem(combinator));
                combinator = null;
            }

            node.sequence.insert(List.createItem(child));
        }
    }

    if (combinator && combinator.name !== ' ') {
        parseError('Unexpected combinator');
    }

    return node;
}

function getDeclarations() {
    var child = null;
    var declarations = new List();

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.RightCurlyBracket:
                break scan;

            case TokenType.Space:
            case TokenType.Comment:
                scanner.next();
                child = null;
                break;

            case TokenType.Semicolon: // ;
                scanner.next();
                child = null;
                break;

            default:
                child = getDeclaration();
        }

        if (child !== null) {
            declarations.insert(List.createItem(child));
        }
    }

    return declarations;
}

function getBlockWithBrackets() {
    var info = getInfo();
    var node;

    eat(TokenType.LeftCurlyBracket);
    node = {
        type: 'Block',
        info: info,
        declarations: getDeclarations()
    };
    eat(TokenType.RightCurlyBracket);

    return node;
}

function getBlock() {
    return {
        type: 'Block',
        info: getInfo(),
        declarations: getDeclarations()
    };
}

function getDeclaration(nested) {
    var info = getInfo();
    var property = getProperty();
    var value;

    eat(TokenType.Colon);

    // check it's a filter
    if (/filter$/.test(property.name.toLowerCase()) && checkProgid()) {
        value = getFilterValue();
    } else {
        value = getValue(nested);
    }

    return {
        type: 'Declaration',
        info: info,
        property: property,
        value: value
    };
}

function getProperty() {
    var name = '';
    var node = {
        type: 'Property',
        info: getInfo(),
        name: null
    };

    for (; scanner.token !== null; scanner.next()) {
        var type = scanner.token.type;

        if (type !== TokenType.Solidus &&
            type !== TokenType.Asterisk &&
            type !== TokenType.DollarSign) {
            break;
        }

        name += scanner.token.value;
    }

    node.name = name + readIdent(true);

    readSC();

    return node;
}

function getValue(nested) {
    var child = null;
    var node = {
        type: 'Value',
        info: getInfo(),
        important: false,
        sequence: new List()
    };

    readSC();

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.RightCurlyBracket:
            case TokenType.Semicolon:
                break scan;

            case TokenType.RightParenthesis:
                if (!nested) {
                    parseError('Unexpected input');
                }
                break scan;

            case TokenType.Space:
                child = getS();
                break;

            case TokenType.Comment: // ignore comments
                scanner.next();
                child = null;
                break;

            case TokenType.NumberSign:
                child = getVhash();
                break;

            case TokenType.Solidus:
            case TokenType.Comma:
                child = getOperator();
                break;

            case TokenType.LeftParenthesis:
            case TokenType.LeftSquareBracket:
                child = getBraces(SCOPE_VALUE);
                break;

            case TokenType.ExclamationMark:
                node.important = getImportant();
                child = null;
                break;

            default:
                // check for unicode range: U+0F00, U+0F00-0FFF, u+0F00??
                if (scanner.token.type === TokenType.Identifier) {
                    var prefix = scanner.token.value;
                    if (prefix === 'U' || prefix === 'u') {
                        if (scanner.lookupType(1, TokenType.PlusSign)) {
                            scanner.next(); // U or u
                            scanner.next(); // +

                            child = {
                                type: 'Identifier',
                                info: getInfo(), // FIXME: wrong position
                                name: prefix + '+' + readUnicodeRange(true)
                            };
                        }
                        break;
                    }
                }

                child = getAny(SCOPE_VALUE);
        }

        if (child !== null) {
            node.sequence.insert(List.createItem(child));
        }
    }

    removeTrailingSpaces(node.sequence);

    return node;
}

// any = string | percentage | dimension | number | uri | functionExpression | funktion | unary | operator | ident
function getAny(scope) {
    switch (scanner.token.type) {
        case TokenType.String:
            return getString();

        case TokenType.LowLine:
        case TokenType.Identifier:
            break;

        case TokenType.FullStop:
        case TokenType.DecimalNumber:
        case TokenType.HyphenMinus:
        case TokenType.PlusSign:
            var number = tryGetNumber();

            if (number !== null) {
                if (scanner.token !== null) {
                    if (scanner.token.type === TokenType.PercentSign) {
                        return getPercentage(number);
                    } else if (scanner.token.type === TokenType.Identifier) {
                        return getDimension(number.value);
                    }
                }

                return number;
            }

            if (scanner.token.type === TokenType.HyphenMinus) {
                var next = scanner.lookup(1);
                if (next && (next.type === TokenType.Identifier || next.type === TokenType.HyphenMinus)) {
                    break;
                }
            }

            if (scanner.token.type === TokenType.HyphenMinus ||
                scanner.token.type === TokenType.PlusSign) {
                return getOperator();
            }

            parseError('Unexpected input');

        default:
            parseError('Unexpected input');
    }

    var ident = getIdentifier(false);

    if (scanner.token !== null && scanner.token.type === TokenType.LeftParenthesis) {
        return getFunction(scope, ident);
    }

    return ident;
}

function readAttrselector() {
    expectAny('Attribute selector (=, ~=, ^=, $=, *=, |=)',
        TokenType.EqualsSign,        // =
        TokenType.Tilde,             // ~=
        TokenType.CircumflexAccent,  // ^=
        TokenType.DollarSign,        // $=
        TokenType.Asterisk,          // *=
        TokenType.VerticalLine       // |=
    );

    var name;

    if (scanner.token.type === TokenType.EqualsSign) {
        name = '=';
        scanner.next();
    } else {
        name = scanner.token.value + '=';
        scanner.next();
        eat(TokenType.EqualsSign);
    }

    return name;
}

// '[' S* attrib_name ']'
// '[' S* attrib_name S* attrib_match S* [ IDENT | STRING ] S* attrib_flags? S* ']'
function getAttribute() {
    var node = {
        type: 'Attribute',
        info: getInfo(),
        name: null,
        operator: null,
        value: null,
        flags: null
    };

    eat(TokenType.LeftSquareBracket);

    readSC();

    node.name = getNamespacedIdentifier(true);

    readSC();

    if (scanner.token !== null && scanner.token.type !== TokenType.RightSquareBracket) {
        // avoid case `[name i]`
        if (scanner.token.type !== TokenType.Identifier) {
            node.operator = readAttrselector();

            readSC();

            if (scanner.token !== null && scanner.token.type === TokenType.String) {
                node.value = getString();
            } else {
                node.value = getIdentifier(false);
            }

            readSC();
        }

        // attribute flags
        if (scanner.token !== null && scanner.token.type === TokenType.Identifier) {
            node.flags = scanner.token.value;

            scanner.next();
            readSC();
        }
    }

    eat(TokenType.RightSquareBracket);

    return node;
}

function getBraces(scope) {
    var close;
    var child = null;
    var node = {
        type: 'Braces',
        info: getInfo(),
        open: scanner.token.value,
        close: null,
        sequence: new List()
    };

    if (scanner.token.type === TokenType.LeftParenthesis) {
        close = TokenType.RightParenthesis;
    } else {
        close = TokenType.RightSquareBracket;
    }

    // left brace
    scanner.next();

    readSC();

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case close:
                node.close = scanner.token.value;
                break scan;

            case TokenType.Space:
                child = getS();
                break;

            case TokenType.Comment:
                scanner.next();
                child = null;
                break;

            case TokenType.NumberSign: // ??
                child = getVhash();
                break;

            case TokenType.LeftParenthesis:
            case TokenType.LeftSquareBracket:
                child = getBraces(scope);
                break;

            case TokenType.Solidus:
            case TokenType.Asterisk:
            case TokenType.Comma:
            case TokenType.Colon:
                child = getOperator();
                break;

            default:
                child = getAny(scope);
        }

        if (child !== null) {
            node.sequence.insert(List.createItem(child));
        }
    }

    removeTrailingSpaces(node.sequence);

    // right brace
    eat(close);

    return node;
}

// '.' ident
function getClass() {
    var info = getInfo();

    eat(TokenType.FullStop);

    return {
        type: 'Class',
        info: info,
        name: readIdent(false)
    };
}

// '#' ident
function getShash() {
    var info = getInfo();

    eat(TokenType.NumberSign);

    return {
        type: 'Id',
        info: info,
        name: readIdent(false)
    };
}

// + | > | ~ | /deep/
function getCombinator() {
    var info = getInfo();
    var combinator;

    switch (scanner.token.type) {
        case TokenType.Space:
            combinator = ' ';
            scanner.next();
            break;

        case TokenType.PlusSign:
        case TokenType.GreaterThanSign:
        case TokenType.Tilde:
            combinator = scanner.token.value;
            scanner.next();
            break;

        case TokenType.Solidus:
            combinator = '/deep/';
            scanner.next();

            expectIdentifier('deep', true);

            eat(TokenType.Solidus);
            break;

        default:
            parseError('Combinator (+, >, ~, /deep/) is expected');
    }

    return {
        type: 'Combinator',
        info: info,
        name: combinator
    };
}

// '/*' .* '*/'
function getComment() {
    var info = getInfo();
    var value = scanner.token.value;
    var len = value.length;

    if (len > 4 && value.charAt(len - 2) === '*' && value.charAt(len - 1) === '/') {
        len -= 2;
    }

    scanner.next();

    return {
        type: 'Comment',
        info: info,
        value: value.substring(2, len)
    };
}

// special reader for units to avoid adjoined IE hacks (i.e. '1px\9')
function readUnit() {
    if (scanner.token !== null && scanner.token.type === TokenType.Identifier) {
        var unit = scanner.token.value;
        var backSlashPos = unit.indexOf('\\');

        // no backslash in unit name
        if (backSlashPos === -1) {
            scanner.next();
            return unit;
        }

        // patch token
        scanner.token.value = unit.substr(backSlashPos);
        scanner.token.offset += backSlashPos;
        scanner.token.column += backSlashPos;

        // return unit w/o backslash part
        return unit.substr(0, backSlashPos);
    }

    parseError('Identifier is expected');
}

// number ident
function getDimension(number) {
    return {
        type: 'Dimension',
        info: getInfo(),
        value: number || readNumber(),
        unit: readUnit()
    };
}

// number "%"
function tryGetPercentage() {
    var number = tryGetNumber();

    if (number && scanner.token !== null && scanner.token.type === TokenType.PercentSign) {
        return getPercentage(number);
    }

    return null;
}

function getPercentage(number) {
    var info;

    if (!number) {
        info = getInfo();
        number = readNumber();
    } else {
        info = number.info;
        number = number.value;
    }

    eat(TokenType.PercentSign);

    return {
        type: 'Percentage',
        info: info,
        value: number
    };
}

// ident '(' functionBody ')' |
// not '(' <simpleSelector>* ')'
function getFunction(scope, ident) {
    var defaultArguments = getFunctionArguments;

    if (!ident) {
        ident = getIdentifier(false);
    }

    // parse special functions
    var name = ident.name.toLowerCase();

    if (specialFunctions.hasOwnProperty(scope)) {
        if (specialFunctions[scope].hasOwnProperty(name)) {
            return specialFunctions[scope][name](scope, ident);
        }
    }

    return getFunctionInternal(defaultArguments, scope, ident);
}

function getFunctionInternal(functionArgumentsReader, scope, ident) {
    var args;

    eat(TokenType.LeftParenthesis);
    args = functionArgumentsReader(scope);
    eat(TokenType.RightParenthesis);

    return {
        type: scope === SCOPE_SELECTOR ? 'FunctionalPseudo' : 'Function',
        info: ident.info,
        name: ident.name,
        arguments: args
    };
}

function getFunctionArguments(scope) {
    var args = new List();
    var argument = null;
    var child = null;

    readSC();

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.RightParenthesis:
                break scan;

            case TokenType.Space:
                child = getS();
                break;

            case TokenType.Comment: // ignore comments
                scanner.next();
                child = null;
                break;

            case TokenType.NumberSign: // TODO: not sure it should be here
                child = getVhash();
                break;

            case TokenType.LeftParenthesis:
            case TokenType.LeftSquareBracket:
                child = getBraces(scope);
                break;

            case TokenType.Comma:
                removeTrailingSpaces(argument.sequence);
                scanner.next();
                readSC();
                argument = null;
                child = null;
                break;

            case TokenType.Solidus:
            case TokenType.Asterisk:
            case TokenType.Colon:
            case TokenType.EqualsSign:
                child = getOperator();
                break;

            default:
                child = getAny(scope);
        }

        if (argument === null) {
            argument = {
                type: 'Argument',
                sequence: new List()
            };
            args.insert(List.createItem(argument));
        }

        if (child !== null) {
            argument.sequence.insert(List.createItem(child));
        }
    }

    if (argument !== null) {
        removeTrailingSpaces(argument.sequence);
    }

    return args;
}

function getVarFunction(scope, ident) {
    return getFunctionInternal(getVarFunctionArguments, scope, ident);
}

function getNotFunctionArguments() {
    var args = new List();
    var wasSelector = false;

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.RightParenthesis:
                if (!wasSelector) {
                    parseError('Simple selector is expected');
                }

                break scan;

            case TokenType.Comma:
                if (!wasSelector) {
                    parseError('Simple selector is expected');
                }

                wasSelector = false;
                scanner.next();
                break;

            default:
                wasSelector = true;
                args.insert(List.createItem(getSimpleSelector(true)));
        }
    }

    return args;
}

function getNotFunction(scope, ident) {
    var args;

    eat(TokenType.LeftParenthesis);
    args = getNotFunctionArguments(scope);
    eat(TokenType.RightParenthesis);

    return {
        type: 'Negation',
        info: ident.info,
        // name: ident.name,  // TODO: add name?
        sequence: args        // FIXME: -> arguments?
    };
}

// var '(' ident (',' <declaration-value>)? ')'
function getVarFunctionArguments() { // TODO: special type Variable?
    var args = new List();

    readSC();

    args.insert(List.createItem({
        type: 'Argument',
        sequence: new List([getIdentifier(true)])
    }));

    readSC();

    if (scanner.token !== null && scanner.token.type === TokenType.Comma) {
        eat(TokenType.Comma);
        readSC();

        args.insert(List.createItem({
            type: 'Argument',
            sequence: new List([getValue(true)])
        }));

        readSC();
    }

    return args;
}

// url '(' ws* (string | raw) ws* ')'
function getUri(scope, ident) {
    var node = {
        type: 'Url',
        info: ident.info,
        // name: ident.name,
        value: null
    };

    eat(TokenType.LeftParenthesis); // (

    readSC();

    if (scanner.token.type === TokenType.String) {
        node.value = getString();
        readSC();
    } else {
        var rawInfo = getInfo();
        var raw = '';

        for (; scanner.token !== null; scanner.next()) {
            var type = scanner.token.type;

            if (type === TokenType.Space ||
                type === TokenType.LeftParenthesis ||
                type === TokenType.RightParenthesis) {
                break;
            }

            raw += scanner.token.value;
        }

        node.value = {
            type: 'Raw',
            info: rawInfo,
            value: raw
        };

        readSC();
    }

    eat(TokenType.RightParenthesis); // )

    return node;
}

// expression '(' raw ')'
function getOldIEExpression(scope, ident) {
    var balance = 0;
    var raw = '';

    eat(TokenType.LeftParenthesis);

    for (; scanner.token !== null; scanner.next()) {
        if (scanner.token.type === TokenType.RightParenthesis) {
            if (balance === 0) {
                break;
            }

            balance--;
        } else if (scanner.token.type === TokenType.LeftParenthesis) {
            balance++;
        }

        raw += scanner.token.value;
    }

    eat(TokenType.RightParenthesis);

    return {
        type: 'Function',
        info: ident.info,
        name: ident.name,
        arguments: new List([{
            type: 'Argument',
            sequence: new List([{
                type: 'Raw',
                value: raw
            }])
        }])
    };
}

function readUnicodeRange(tryNext) {
    var hex = '';

    for (; scanner.token !== null; scanner.next()) {
        if (scanner.token.type !== TokenType.DecimalNumber &&
            scanner.token.type !== TokenType.Identifier) {
            break;
        }

        hex += scanner.token.value;
    }

    if (!/^[0-9a-f]{1,6}$/i.test(hex)) {
        parseError('Unexpected input');
    }

    // U+abc???
    if (tryNext) {
        for (; hex.length < 6 && scanner.token !== null; scanner.next()) {
            if (scanner.token.type !== TokenType.QuestionMark) {
                break;
            }

            hex += scanner.token.value;
            tryNext = false;
        }
    }

    // U+aaa-bbb
    if (tryNext) {
        if (scanner.token !== null && scanner.token.type === TokenType.HyphenMinus) {
            scanner.next();

            var next = readUnicodeRange(false);

            if (!next) {
                parseError('Unexpected input');
            }

            hex += '-' + next;
        }
    }

    return hex;
}

function readIdent(varAllowed) {
    var name = '';

    // optional first -
    if (scanner.token !== null && scanner.token.type === TokenType.HyphenMinus) {
        name = '-';
        scanner.next();

        if (varAllowed && scanner.token !== null && scanner.token.type === TokenType.HyphenMinus) {
            name = '--';
            scanner.next();
        }
    }

    expectAny('Identifier',
        TokenType.LowLine,
        TokenType.Identifier
    );

    if (scanner.token !== null) {
        name += scanner.token.value;
        scanner.next();

        for (; scanner.token !== null; scanner.next()) {
            var type = scanner.token.type;

            if (type !== TokenType.LowLine &&
                type !== TokenType.Identifier &&
                type !== TokenType.DecimalNumber &&
                type !== TokenType.HyphenMinus) {
                break;
            }

            name += scanner.token.value;
        }
    }

    return name;
}

function getNamespacedIdentifier(checkColon) {
    if (scanner.token === null) {
        parseError('Unexpected end of input');
    }

    var info = getInfo();
    var name;

    if (scanner.token.type === TokenType.Asterisk) {
        checkColon = false;
        name = '*';
        scanner.next();
    } else {
        name = readIdent(false);
    }

    if (scanner.token !== null) {
        if (scanner.token.type === TokenType.VerticalLine &&
            scanner.lookupType(1, TokenType.EqualsSign) === false) {
            name += '|';

            if (scanner.next() !== null) {
                if (scanner.token.type === TokenType.HyphenMinus ||
                    scanner.token.type === TokenType.Identifier ||
                    scanner.token.type === TokenType.LowLine) {
                    name += readIdent(false);
                } else if (scanner.token.type === TokenType.Asterisk) {
                    checkColon = false;
                    name += '*';
                    scanner.next();
                }
            }
        }
    }

    if (checkColon && scanner.token !== null && scanner.token.type === TokenType.Colon) {
        scanner.next();
        name += ':' + readIdent(false);
    }

    return {
        type: 'Identifier',
        info: info,
        name: name
    };
}

function getIdentifier(varAllowed) {
    return {
        type: 'Identifier',
        info: getInfo(),
        name: readIdent(varAllowed)
    };
}

// ! ws* important
function getImportant() { // TODO?
    // var info = getInfo();

    eat(TokenType.ExclamationMark);

    readSC();

    // return {
    //     type: 'Identifier',
    //     info: info,
    //     name: readIdent(false)
    // };

    expectIdentifier('important');

    readIdent(false);

    // should return identifier in future for original source restoring as is
    // returns true for now since it's fit to optimizer purposes
    return true;
}

// odd | even | number? n
function getNth() {
    expectAny('Number, odd or even',
        TokenType.Identifier,
        TokenType.DecimalNumber
    );

    var info = getInfo();
    var value = scanner.token.value;
    var cmpValue;

    if (scanner.token.type === TokenType.DecimalNumber) {
        var next = scanner.lookup(1);
        if (next !== null &&
            next.type === TokenType.Identifier &&
            next.value.toLowerCase() === 'n') {
            value += next.value;
            scanner.next();
        }
    } else {
        var cmpValue = value.toLowerCase();
        if (cmpValue !== 'odd' && cmpValue !== 'even' && cmpValue !== 'n') {
            parseError('Unexpected identifier');
        }
    }

    scanner.next();

    return {
        type: 'Nth',
        info: info,
        value: value
    };
}

function getNthSelector() {
    var info = getInfo();
    var sequence = new List();
    var node;
    var child = null;

    eat(TokenType.Colon);
    expectIdentifier('nth', false);

    node = {
        type: 'FunctionalPseudo',
        info: info,
        name: readIdent(false),
        arguments: new List([{
            type: 'Argument',
            sequence: sequence
        }])
    };

    eat(TokenType.LeftParenthesis);

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.RightParenthesis:
                break scan;

            case TokenType.Space:
            case TokenType.Comment:
                scanner.next();
                child = null;
                break;

            case TokenType.HyphenMinus:
            case TokenType.PlusSign:
                child = getOperator();
                break;

            default:
                child = getNth();
        }

        if (child !== null) {
            sequence.insert(List.createItem(child));
        }
    }

    eat(TokenType.RightParenthesis);

    return node;
}

function readNumber() {
    var wasDigits = false;
    var number = '';
    var offset = 0;

    if (scanner.lookupType(offset, TokenType.HyphenMinus)) {
        number = '-';
        offset++;
    }

    if (scanner.lookupType(offset, TokenType.DecimalNumber)) {
        wasDigits = true;
        number += scanner.lookup(offset).value;
        offset++;
    }

    if (scanner.lookupType(offset, TokenType.FullStop)) {
        number += '.';
        offset++;
    }

    if (scanner.lookupType(offset, TokenType.DecimalNumber)) {
        wasDigits = true;
        number += scanner.lookup(offset).value;
        offset++;
    }

    if (wasDigits) {
        while (offset--) {
            scanner.next();
        }

        return number;
    }

    return null;
}

function tryGetNumber() {
    var info = getInfo();
    var number = readNumber();

    if (number !== null) {
        return {
            type: 'Number',
            info: info,
            value: number
        };
    }

    return null;
}

// '/' | '*' | ',' | ':' | '=' | '+' | '-'
// TODO: remove '=' since it's wrong operator, but theat as operator
// to make old things like `filter: alpha(opacity=0)` works
function getOperator() {
    var node = {
        type: 'Operator',
        info: getInfo(),
        value: scanner.token.value
    };

    scanner.next();

    return node;
}

function getFilterValue() { // TODO
    var progid;
    var node = {
        type: 'Value',
        info: getInfo(),
        important: false,
        sequence: new List()
    };

    while (progid = checkProgid()) {
        node.sequence.insert(List.createItem(getProgid(progid)));
    }

    readSC(node);

    if (scanner.token !== null && scanner.token.type === TokenType.ExclamationMark) {
        node.important = getImportant();
    }

    return node;
}

// 'progid:' ws* 'DXImageTransform.Microsoft.' ident ws* '(' .* ')'
function checkProgid() {
    function checkSC(offset) {
        for (var cursor; cursor = scanner.lookup(offset); offset++) {
            if (cursor.type !== TokenType.Space &&
                cursor.type !== TokenType.Comment) {
                break;
            }
        }

        return offset;
    }

    var offset = checkSC(0);

    if (scanner.lookup(offset + 1) === null ||
        scanner.lookup(offset + 0).value.toLowerCase() !== 'progid' ||
        scanner.lookup(offset + 1).type !== TokenType.Colon) {
        return false; // fail
    }

    offset += 2;
    offset = checkSC(offset);

    if (scanner.lookup(offset + 5) === null ||
        scanner.lookup(offset + 0).value.toLowerCase() !== 'dximagetransform' ||
        scanner.lookup(offset + 1).type !== TokenType.FullStop ||
        scanner.lookup(offset + 2).value.toLowerCase() !== 'microsoft' ||
        scanner.lookup(offset + 3).type !== TokenType.FullStop ||
        scanner.lookup(offset + 4).type !== TokenType.Identifier) {
        return false; // fail
    }

    offset += 5;
    offset = checkSC(offset);

    if (scanner.lookupType(offset, TokenType.LeftParenthesis) === false) {
        return false; // fail
    }

    for (var cursor; cursor = scanner.lookup(offset); offset++) {
        if (cursor.type === TokenType.RightParenthesis) {
            return cursor;
        }
    }

    return false;
}

function getProgid(progidEnd) {
    var value = '';
    var node = {
        type: 'Progid',
        info: getInfo(),
        value: null
    };

    if (!progidEnd) {
        progidEnd = checkProgid();
    }

    if (!progidEnd) {
        parseError('progid is expected');
    }

    readSC(node);

    var rawInfo = getInfo();
    for (; scanner.token && scanner.token !== progidEnd; scanner.next()) {
        value += scanner.token.value;
    }

    eat(TokenType.RightParenthesis);
    value += ')';

    node.value = {
        type: 'Raw',
        info: rawInfo,
        value: value
    };

    readSC(node);

    return node;
}

// <pseudo-element> | <nth-selector> | <pseudo-class>
function getPseudo() {
    var next = scanner.lookup(1);

    if (next === null) {
        scanner.next();
        parseError('Colon or identifier is expected');
    }

    if (next.type === TokenType.Colon) {
        return getPseudoElement();
    }

    if (next.type === TokenType.Identifier &&
        next.value.toLowerCase() === 'nth') {
        return getNthSelector();
    }

    return getPseudoClass();
}

// :: ident
function getPseudoElement() {
    var info = getInfo();

    eat(TokenType.Colon);
    eat(TokenType.Colon);

    return {
        type: 'PseudoElement',
        info: info,
        name: readIdent(false)
    };
}

// : ( ident | function )
function getPseudoClass() {
    var info = getInfo();
    var ident = eat(TokenType.Colon) && getIdentifier(false);

    if (scanner.token !== null && scanner.token.type === TokenType.LeftParenthesis) {
        return getFunction(SCOPE_SELECTOR, ident);
    }

    return {
        type: 'PseudoClass',
        info: info,
        name: ident.name
    };
}

// ws
function getS() {
    var node = {
        type: 'Space'
        // value: scanner.token.value
    };

    scanner.next();

    return node;
}

function readSC() {
    // var nodes = [];

    scan:
    while (scanner.token !== null) {
        switch (scanner.token.type) {
            case TokenType.Space:
                scanner.next();
                // nodes.push(getS());
                break;

            case TokenType.Comment:
                scanner.next();
                // nodes.push(getComment());
                break;

            default:
                break scan;
        }
    }

    return null;

    // return nodes.length ? new List(nodes) : null;
}

// node: String
function getString() {
    var node = {
        type: 'String',
        info: getInfo(),
        value: scanner.token.value
    };

    scanner.next();

    return node;
}

// # ident
function getVhash() {
    var info = getInfo();
    var value;

    eat(TokenType.NumberSign);

    expectAny('Number or identifier',
        TokenType.DecimalNumber,
        TokenType.Identifier
    );

    value = scanner.token.value;

    if (scanner.token.type === TokenType.DecimalNumber &&
        scanner.lookupType(1, TokenType.Identifier)) {
        scanner.next();
        value += scanner.token.value;
    }

    scanner.next();

    return {
        type: 'Hash',
        info: info,
        value: value
    };
}

module.exports = function parse(source, options) {
    var ast;

    if (!options || typeof options !== 'object') {
        options = {};
    }

    var context = options.context || 'stylesheet';
    needPositions = Boolean(options.positions);
    filename = options.filename || '<unknown>';

    if (!initialContext.hasOwnProperty(context)) {
        throw new Error('Unknown context `' + context + '`');
    }

    scanner = new Scanner(source, blockMode.hasOwnProperty(context), options.line, options.column);
    scanner.next();
    ast = initialContext[context]();

    scanner = null;

    // console.log(JSON.stringify(ast, null, 4));
    return ast;
};
