var optimizeProperties = require('../properties/optimizer');

var removeDuplicates = require('./remove-duplicates');
var mergeAdjacent = require('./merge-adjacent');
var reduceNonAdjacent = require('./reduce-non-adjacent');
var mergeNonAdjacentBySelector = require('./merge-non-adjacent-by-selector');
var mergeNonAdjacentByBody = require('./merge-non-adjacent-by-body');
var restructure = require('./restructure');
var removeDuplicateMediaQueries = require('./remove-duplicate-media-queries');
var mergeMediaQueries = require('./merge-media-queries');

function removeEmpty(tokens) {
  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];
    var isEmpty = false;

    switch (token[0]) {
      case 'selector':
        isEmpty = token[1].length === 0 || token[2].length === 0;
        break;
      case 'block':
        removeEmpty(token[2]);
        isEmpty = token[2].length === 0;
    }

    if (isEmpty) {
      tokens.splice(i, 1);
      i--;
      l--;
    }
  }
}

function recursivelyOptimizeBlocks(tokens, options, context) {
  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];

    if (token[0] == 'block') {
      var isKeyframes = /@(-moz-|-o-|-webkit-)?keyframes/.test(token[1][0]);
      optimize(token[2], options, context, !isKeyframes);
    }
  }
}

function recursivelyOptimizeProperties(tokens, options, context) {
  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];

    switch (token[0]) {
      case 'selector':
        optimizeProperties(token[1], token[2], false, true, options, context);
        break;
      case 'block':
        recursivelyOptimizeProperties(token[2], options, context);
    }
  }
}

function optimize(tokens, options, context, withRestructuring) {
  recursivelyOptimizeBlocks(tokens, options, context);
  recursivelyOptimizeProperties(tokens, options, context);

  removeDuplicates(tokens);
  mergeAdjacent(tokens, options, context);
  reduceNonAdjacent(tokens, options, context);

  mergeNonAdjacentBySelector(tokens, options, context);
  mergeNonAdjacentByBody(tokens, options);

  if (options.restructuring && withRestructuring) {
    restructure(tokens, options);
    mergeAdjacent(tokens, options, context);
  }

  if (options.mediaMerging) {
    removeDuplicateMediaQueries(tokens);
    var reduced = mergeMediaQueries(tokens);
    for (var i = reduced.length - 1; i >= 0; i--) {
      optimize(reduced[i][2], options, context, false);
    }
  }

  removeEmpty(tokens);
}

module.exports = optimize;
