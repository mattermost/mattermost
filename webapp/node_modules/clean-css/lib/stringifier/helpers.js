var lineBreak = require('os').EOL;

var AT_RULE = 'at-rule';
var PROPERTY_SEPARATOR = ';';

function hasMoreProperties(tokens, index) {
  for (var i = index, l = tokens.length; i < l; i++) {
    if (typeof tokens[i] != 'string')
      return true;
  }

  return false;
}

function supportsAfterClosingBrace(token) {
  return token[0][0] == 'background' || token[0][0] == 'transform' || token[0][0] == 'src';
}

function afterClosingBrace(token, valueIndex) {
  return token[valueIndex][0][token[valueIndex][0].length - 1] == ')' || token[valueIndex][0].indexOf('__ESCAPED_URL_CLEAN_CSS') === 0;
}

function afterComma(token, valueIndex) {
  return token[valueIndex][0] == ',';
}

function afterSlash(token, valueIndex) {
  return token[valueIndex][0] == '/';
}

function beforeComma(token, valueIndex) {
  return token[valueIndex + 1] && token[valueIndex + 1][0] == ',';
}

function beforeSlash(token, valueIndex) {
  return token[valueIndex + 1] && token[valueIndex + 1][0] == '/';
}

function inFilter(token) {
  return token[0][0] == 'filter' || token[0][0] == '-ms-filter';
}

function inSpecialContext(token, valueIndex, context) {
  return !context.spaceAfterClosingBrace && supportsAfterClosingBrace(token) && afterClosingBrace(token, valueIndex) ||
    beforeSlash(token, valueIndex) ||
    afterSlash(token, valueIndex) ||
    beforeComma(token, valueIndex) ||
    afterComma(token, valueIndex);
}

function selectors(tokens, context) {
  var store = context.store;

  for (var i = 0, l = tokens.length; i < l; i++) {
    store(tokens[i], context);

    if (i < l - 1)
      store(',', context);
  }
}

function body(tokens, context) {
  for (var i = 0, l = tokens.length; i < l; i++) {
    property(tokens, i, i == l - 1, context);
  }
}

function property(tokens, position, isLast, context) {
  var store = context.store;
  var token = tokens[position];

  if (typeof token == 'string') {
    store(token, context);
  } else if (token[0] == AT_RULE) {
    propertyAtRule(token[1], isLast, context);
  } else {
    store(token[0], context);
    store(':', context);
    value(tokens, position, isLast, context);
  }
}

function propertyAtRule(value, isLast, context) {
  var store = context.store;

  store(value, context);
  if (!isLast)
    store(PROPERTY_SEPARATOR, context);
}

function value(tokens, position, isLast, context) {
  var store = context.store;
  var token = tokens[position];
  var isVariableDeclaration = token[0][0].indexOf('--') === 0;
  var isBlockVariable = isVariableDeclaration && Array.isArray(token[1][0]);

  if (isVariableDeclaration && isBlockVariable && atRulesOrProperties(token[1])) {
    store('{', context);
    body(token[1], context);
    store('};', context);
    return;
  }

  for (var j = 1, m = token.length; j < m; j++) {
    store(token[j], context);

    if (j < m - 1 && (inFilter(token) || !inSpecialContext(token, j, context))) {
      store(' ', context);
    } else if (j == m - 1 && !isLast && hasMoreProperties(tokens, position + 1)) {
      store(PROPERTY_SEPARATOR, context);
    }
  }
}

function atRulesOrProperties(values) {
  for (var i = 0, l = values.length; i < l; i++) {
    if (values[i][0] == AT_RULE || Array.isArray(values[i][0]))
      return true;
  }

  return false;
}

function all(tokens, context) {
  var joinCharacter = context.keepBreaks ? lineBreak : '';
  var store = context.store;

  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];

    switch (token[0]) {
      case 'at-rule':
      case 'text':
        store(token[1][0], context);
        store(joinCharacter, context);
        break;
      case 'block':
        selectors([token[1]], context);
        store('{', context);
        all(token[2], context);
        store('}', context);
        store(joinCharacter, context);
        break;
      case 'flat-block':
        selectors([token[1]], context);
        store('{', context);
        body(token[2], context);
        store('}', context);
        store(joinCharacter, context);
        break;
      default:
        selectors(token[1], context);
        store('{', context);
        body(token[2], context);
        store('}', context);
        store(joinCharacter, context);
    }
  }
}

module.exports = {
  all: all,
  body: body,
  property: property,
  selectors: selectors,
  value: value
};
