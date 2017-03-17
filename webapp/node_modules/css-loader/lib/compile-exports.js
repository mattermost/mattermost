var camelCase = require("lodash.camelcase");

function dashesCamelCase(str) {
  return str.replace(/-(\w)/g, function(match, firstLetter) {
    return firstLetter.toUpperCase();
  });
}

module.exports = function compileExports(result, importItemMatcher, camelCaseKeys) {
  if (!Object.keys(result.exports).length) {
    return "";
  }

  var exportJs = Object.keys(result.exports).reduce(function(res, key) {
    var valueAsString = JSON.stringify(result.exports[key]);
    valueAsString = valueAsString.replace(result.importItemRegExpG, importItemMatcher);
    res.push("\t" + JSON.stringify(key) + ": " + valueAsString);

    if (camelCaseKeys === true) {
      res.push("\t" + JSON.stringify(camelCase(key)) + ": " + valueAsString);
    } else if (camelCaseKeys === 'dashes') {
      res.push("\t" + JSON.stringify(dashesCamelCase(key)) + ": " + valueAsString);
    }

    return res;
  }, []).join(",\n");

  return "{\n" + exportJs + "\n}";
};
