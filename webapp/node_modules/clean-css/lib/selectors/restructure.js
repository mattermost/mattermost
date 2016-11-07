var extractProperties = require('./extractor');
var canReorderSingle = require('./reorderable').canReorderSingle;
var stringifyBody = require('../stringifier/one-time').body;
var stringifySelectors = require('../stringifier/one-time').selectors;
var cleanUpSelectorDuplicates = require('./clean-up').selectorDuplicates;
var isSpecial = require('./is-special');
var cloneArray = require('../utils/clone-array');

function naturalSorter(a, b) {
  return a > b;
}

function cloneAndMergeSelectors(propertyA, propertyB) {
  var cloned = cloneArray(propertyA);
  cloned[5] = cloned[5].concat(propertyB[5]);

  return cloned;
}

function restructure(tokens, options) {
  var movableTokens = {};
  var movedProperties = [];
  var multiPropertyMoveCache = {};
  var movedToBeDropped = [];
  var maxCombinationsLevel = 2;
  var ID_JOIN_CHARACTER = '%';

  function sendToMultiPropertyMoveCache(position, movedProperty, allFits) {
    for (var i = allFits.length - 1; i >= 0; i--) {
      var fit = allFits[i][0];
      var id = addToCache(movedProperty, fit);

      if (multiPropertyMoveCache[id].length > 1 && processMultiPropertyMove(position, multiPropertyMoveCache[id])) {
        removeAllMatchingFromCache(id);
        break;
      }
    }
  }

  function addToCache(movedProperty, fit) {
    var id = cacheId(fit);
    multiPropertyMoveCache[id] = multiPropertyMoveCache[id] || [];
    multiPropertyMoveCache[id].push([movedProperty, fit]);
    return id;
  }

  function removeAllMatchingFromCache(matchId) {
    var matchSelectors = matchId.split(ID_JOIN_CHARACTER);
    var forRemoval = [];
    var i;

    for (var id in multiPropertyMoveCache) {
      var selectors = id.split(ID_JOIN_CHARACTER);
      for (i = selectors.length - 1; i >= 0; i--) {
        if (matchSelectors.indexOf(selectors[i]) > -1) {
          forRemoval.push(id);
          break;
        }
      }
    }

    for (i = forRemoval.length - 1; i >= 0; i--) {
      delete multiPropertyMoveCache[forRemoval[i]];
    }
  }

  function cacheId(cachedTokens) {
    var id = [];
    for (var i = 0, l = cachedTokens.length; i < l; i++) {
      id.push(stringifySelectors(cachedTokens[i][1]));
    }
    return id.join(ID_JOIN_CHARACTER);
  }

  function tokensToMerge(sourceTokens) {
    var uniqueTokensWithBody = [];
    var mergeableTokens = [];

    for (var i = sourceTokens.length - 1; i >= 0; i--) {
      if (isSpecial(options, stringifySelectors(sourceTokens[i][1])))
        continue;

      mergeableTokens.unshift(sourceTokens[i]);
      if (sourceTokens[i][2].length > 0 && uniqueTokensWithBody.indexOf(sourceTokens[i]) == -1)
        uniqueTokensWithBody.push(sourceTokens[i]);
    }

    return uniqueTokensWithBody.length > 1 ?
      mergeableTokens :
      [];
  }

  function shortenIfPossible(position, movedProperty) {
    var name = movedProperty[0];
    var value = movedProperty[1];
    var key = movedProperty[4];
    var valueSize = name.length + value.length + 1;
    var allSelectors = [];
    var qualifiedTokens = [];

    var mergeableTokens = tokensToMerge(movableTokens[key]);
    if (mergeableTokens.length < 2)
      return;

    var allFits = findAllFits(mergeableTokens, valueSize, 1);
    var bestFit = allFits[0];
    if (bestFit[1] > 0)
      return sendToMultiPropertyMoveCache(position, movedProperty, allFits);

    for (var i = bestFit[0].length - 1; i >=0; i--) {
      allSelectors = bestFit[0][i][1].concat(allSelectors);
      qualifiedTokens.unshift(bestFit[0][i]);
    }

    allSelectors = cleanUpSelectorDuplicates(allSelectors);
    dropAsNewTokenAt(position, [movedProperty], allSelectors, qualifiedTokens);
  }

  function fitSorter(fit1, fit2) {
    return fit1[1] > fit2[1];
  }

  function findAllFits(mergeableTokens, propertySize, propertiesCount) {
    var combinations = allCombinations(mergeableTokens, propertySize, propertiesCount, maxCombinationsLevel - 1);
    return combinations.sort(fitSorter);
  }

  function allCombinations(tokensVariant, propertySize, propertiesCount, level) {
    var differenceVariants = [[tokensVariant, sizeDifference(tokensVariant, propertySize, propertiesCount)]];
    if (tokensVariant.length > 2 && level > 0) {
      for (var i = tokensVariant.length - 1; i >= 0; i--) {
        var subVariant = Array.prototype.slice.call(tokensVariant, 0);
        subVariant.splice(i, 1);
        differenceVariants = differenceVariants.concat(allCombinations(subVariant, propertySize, propertiesCount, level - 1));
      }
    }

    return differenceVariants;
  }

  function sizeDifference(tokensVariant, propertySize, propertiesCount) {
    var allSelectorsSize = 0;
    for (var i = tokensVariant.length - 1; i >= 0; i--) {
      allSelectorsSize += tokensVariant[i][2].length > propertiesCount ? stringifySelectors(tokensVariant[i][1]).length : -1;
    }
    return allSelectorsSize - (tokensVariant.length - 1) * propertySize + 1;
  }

  function dropAsNewTokenAt(position, properties, allSelectors, mergeableTokens) {
    var i, j, k, m;
    var allProperties = [];

    for (i = mergeableTokens.length - 1; i >= 0; i--) {
      var mergeableToken = mergeableTokens[i];

      for (j = mergeableToken[2].length - 1; j >= 0; j--) {
        var mergeableProperty = mergeableToken[2][j];

        for (k = 0, m = properties.length; k < m; k++) {
          var property = properties[k];

          var mergeablePropertyName = mergeableProperty[0][0];
          var propertyName = property[0];
          var propertyBody = property[4];
          if (mergeablePropertyName == propertyName && stringifyBody([mergeableProperty]) == propertyBody) {
            mergeableToken[2].splice(j, 1);
            break;
          }
        }
      }
    }

    for (i = properties.length - 1; i >= 0; i--) {
      allProperties.unshift(properties[i][3]);
    }

    var newToken = ['selector', allSelectors, allProperties];
    tokens.splice(position, 0, newToken);
  }

  function dropPropertiesAt(position, movedProperty) {
    var key = movedProperty[4];
    var toMove = movableTokens[key];

    if (toMove && toMove.length > 1) {
      if (!shortenMultiMovesIfPossible(position, movedProperty))
        shortenIfPossible(position, movedProperty);
    }
  }

  function shortenMultiMovesIfPossible(position, movedProperty) {
    var candidates = [];
    var propertiesAndMergableTokens = [];
    var key = movedProperty[4];
    var j, k;

    var mergeableTokens = tokensToMerge(movableTokens[key]);
    if (mergeableTokens.length < 2)
      return;

    movableLoop:
    for (var value in movableTokens) {
      var tokensList = movableTokens[value];

      for (j = mergeableTokens.length - 1; j >= 0; j--) {
        if (tokensList.indexOf(mergeableTokens[j]) == -1)
          continue movableLoop;
      }

      candidates.push(value);
    }

    if (candidates.length < 2)
      return false;

    for (j = candidates.length - 1; j >= 0; j--) {
      for (k = movedProperties.length - 1; k >= 0; k--) {
        if (movedProperties[k][4] == candidates[j]) {
          propertiesAndMergableTokens.unshift([movedProperties[k], mergeableTokens]);
          break;
        }
      }
    }

    return processMultiPropertyMove(position, propertiesAndMergableTokens);
  }

  function processMultiPropertyMove(position, propertiesAndMergableTokens) {
    var valueSize = 0;
    var properties = [];
    var property;

    for (var i = propertiesAndMergableTokens.length - 1; i >= 0; i--) {
      property = propertiesAndMergableTokens[i][0];
      var fullValue = property[4];
      valueSize += fullValue.length + (i > 0 ? 1 : 0);

      properties.push(property);
    }

    var mergeableTokens = propertiesAndMergableTokens[0][1];
    var bestFit = findAllFits(mergeableTokens, valueSize, properties.length)[0];
    if (bestFit[1] > 0)
      return false;

    var allSelectors = [];
    var qualifiedTokens = [];
    for (i = bestFit[0].length - 1; i >= 0; i--) {
      allSelectors = bestFit[0][i][1].concat(allSelectors);
      qualifiedTokens.unshift(bestFit[0][i]);
    }

    allSelectors = cleanUpSelectorDuplicates(allSelectors);
    dropAsNewTokenAt(position, properties, allSelectors, qualifiedTokens);

    for (i = properties.length - 1; i >= 0; i--) {
      property = properties[i];
      var index = movedProperties.indexOf(property);

      delete movableTokens[property[4]];

      if (index > -1 && movedToBeDropped.indexOf(index) == -1)
        movedToBeDropped.push(index);
    }

    return true;
  }

  function boundToAnotherPropertyInCurrrentToken(property, movedProperty, token) {
    var propertyName = property[0];
    var movedPropertyName = movedProperty[0];
    if (propertyName != movedPropertyName)
      return false;

    var key = movedProperty[4];
    var toMove = movableTokens[key];
    return toMove && toMove.indexOf(token) > -1;
  }

  for (var i = tokens.length - 1; i >= 0; i--) {
    var token = tokens[i];
    var isSelector;
    var j, k, m;
    var samePropertyAt;

    if (token[0] == 'selector') {
      isSelector = true;
    } else if (token[0] == 'block') {
      isSelector = false;
    } else {
      continue;
    }

    // We cache movedProperties.length as it may change in the loop
    var movedCount = movedProperties.length;

    var properties = extractProperties(token);
    movedToBeDropped = [];

    var unmovableInCurrentToken = [];
    for (j = properties.length - 1; j >= 0; j--) {
      for (k = j - 1; k >= 0; k--) {
        if (!canReorderSingle(properties[j], properties[k])) {
          unmovableInCurrentToken.push(j);
          break;
        }
      }
    }

    for (j = properties.length - 1; j >= 0; j--) {
      var property = properties[j];
      var movedSameProperty = false;

      for (k = 0; k < movedCount; k++) {
        var movedProperty = movedProperties[k];

        if (movedToBeDropped.indexOf(k) == -1 && !canReorderSingle(property, movedProperty) && !boundToAnotherPropertyInCurrrentToken(property, movedProperty, token)) {
          dropPropertiesAt(i + 1, movedProperty, token);

          if (movedToBeDropped.indexOf(k) == -1) {
            movedToBeDropped.push(k);
            delete movableTokens[movedProperty[4]];
          }
        }

        if (!movedSameProperty) {
          movedSameProperty = property[0] == movedProperty[0] && property[1] == movedProperty[1];

          if (movedSameProperty) {
            samePropertyAt = k;
          }
        }
      }

      if (!isSelector || unmovableInCurrentToken.indexOf(j) > -1)
        continue;

      var key = property[4];
      movableTokens[key] = movableTokens[key] || [];
      movableTokens[key].push(token);

      if (movedSameProperty) {
        movedProperties[samePropertyAt] = cloneAndMergeSelectors(movedProperties[samePropertyAt], property);
      } else {
        movedProperties.push(property);
      }
    }

    movedToBeDropped = movedToBeDropped.sort(naturalSorter);
    for (j = 0, m = movedToBeDropped.length; j < m; j++) {
      var dropAt = movedToBeDropped[j] - j;
      movedProperties.splice(dropAt, 1);
    }
  }

  var position = tokens[0] && tokens[0][0] == 'at-rule' && tokens[0][1][0].indexOf('@charset') === 0 ? 1 : 0;
  for (; position < tokens.length - 1; position++) {
    var isImportRule = tokens[position][0] === 'at-rule' && tokens[position][1][0].indexOf('@import') === 0;
    var isEscapedCommentSpecial = tokens[position][0] === 'text' && tokens[position][1][0].indexOf('__ESCAPED_COMMENT_SPECIAL') === 0;
    if (!(isImportRule || isEscapedCommentSpecial))
      break;
  }

  for (i = 0; i < movedProperties.length; i++) {
    dropPropertiesAt(position, movedProperties[i]);
  }
}

module.exports = restructure;
