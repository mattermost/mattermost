var stringifyBody = require('../stringifier/one-time').body;
var stringifySelectors = require('../stringifier/one-time').selectors;
var cleanUpSelectors = require('./clean-up').selectors;
var isSpecial = require('./is-special');

function unsafeSelector(value) {
  return /\.|\*| :/.test(value);
}

function isBemElement(token) {
  var asString = stringifySelectors(token[1]);
  return asString.indexOf('__') > -1 || asString.indexOf('--') > -1;
}

function withoutModifier(selector) {
  return selector.replace(/--[^ ,>\+~:]+/g, '');
}

function removeAnyUnsafeElements(left, candidates) {
  var leftSelector = withoutModifier(stringifySelectors(left[1]));

  for (var body in candidates) {
    var right = candidates[body];
    var rightSelector = withoutModifier(stringifySelectors(right[1]));

    if (rightSelector.indexOf(leftSelector) > -1 || leftSelector.indexOf(rightSelector) > -1)
      delete candidates[body];
  }
}

function mergeNonAdjacentByBody(tokens, options) {
  var candidates = {};
  var adjacentSpace = options.compatibility.selectors.adjacentSpace;

  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    if (token[0] != 'selector')
      continue;

    if (token[2].length > 0 && (!options.semanticMerging && unsafeSelector(stringifySelectors(token[1]))))
      candidates = {};

    if (token[2].length > 0 && options.semanticMerging && isBemElement(token))
      removeAnyUnsafeElements(token, candidates);

    var candidateBody = stringifyBody(token[2]);
    var oldToken = candidates[candidateBody];
    if (oldToken && !isSpecial(options, stringifySelectors(token[1])) && !isSpecial(options, stringifySelectors(oldToken[1]))) {
      token[1] = token[2].length > 0 ?
        cleanUpSelectors(oldToken[1].concat(token[1]), false, adjacentSpace) :
        oldToken[1].concat(token[1]);

      oldToken[2] = [];
      candidates[candidateBody] = null;
    }

    candidates[stringifyBody(token[2])] = token;
  }
}

module.exports = mergeNonAdjacentByBody;
