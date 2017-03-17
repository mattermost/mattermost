var optimizeProperties = require('../properties/optimizer');

var stringifyBody = require('../stringifier/one-time').body;
var stringifySelectors = require('../stringifier/one-time').selectors;
var cleanUpSelectors = require('./clean-up').selectors;
var isSpecial = require('./is-special');

function mergeAdjacent(tokens, options, context) {
  var lastToken = [null, [], []];
  var adjacentSpace = options.compatibility.selectors.adjacentSpace;

  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];

    if (token[0] != 'selector') {
      lastToken = [null, [], []];
      continue;
    }

    if (lastToken[0] == 'selector' && stringifySelectors(token[1]) == stringifySelectors(lastToken[1])) {
      var joinAt = [lastToken[2].length];
      Array.prototype.push.apply(lastToken[2], token[2]);
      optimizeProperties(token[1], lastToken[2], joinAt, true, options, context);
      token[2] = [];
    } else if (lastToken[0] == 'selector' && stringifyBody(token[2]) == stringifyBody(lastToken[2]) &&
        !isSpecial(options, stringifySelectors(token[1])) && !isSpecial(options, stringifySelectors(lastToken[1]))) {
      lastToken[1] = cleanUpSelectors(lastToken[1].concat(token[1]), false, adjacentSpace);
      token[2] = [];
    } else {
      lastToken = token;
    }
  }
}

module.exports = mergeAdjacent;
