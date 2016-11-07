var stringifyAll = require('../stringifier/one-time').all;

function removeDuplicateMediaQueries(tokens) {
  var candidates = {};

  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];
    if (token[0] != 'block')
      continue;

    var key = token[1][0] + '%' + stringifyAll(token[2]);
    var candidate = candidates[key];

    if (candidate)
      candidate[2] = [];

    candidates[key] = token;
  }
}

module.exports = removeDuplicateMediaQueries;
