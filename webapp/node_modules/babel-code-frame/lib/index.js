"use strict";

exports.__esModule = true;

exports.default = function (rawLines, lineNumber, colNumber) {
  var opts = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

  colNumber = Math.max(colNumber, 0);

  var highlighted = opts.highlightCode && _chalk2.default.supportsColor;
  var maybeHighlight = function maybeHighlight(chalkFn, string) {
    return highlighted ? chalkFn(string) : string;
  };
  if (highlighted) rawLines = highlight(rawLines);

  var linesAbove = opts.linesAbove || 2;
  var linesBelow = opts.linesBelow || 3;

  var lines = rawLines.split(NEWLINE);
  var start = Math.max(lineNumber - (linesAbove + 1), 0);
  var end = Math.min(lines.length, lineNumber + linesBelow);

  if (!lineNumber && !colNumber) {
    start = 0;
    end = lines.length;
  }

  var numberMaxWidth = String(end).length;

  var frame = lines.slice(start, end).map(function (line, index) {
    var number = start + 1 + index;
    var paddedNumber = (" " + number).slice(-numberMaxWidth);
    var gutter = " " + paddedNumber + " | ";
    if (number === lineNumber) {
      var markerLine = "";
      if (colNumber) {
        var markerSpacing = line.slice(0, colNumber - 1).replace(/[^\t]/g, " ");
        markerLine = ["\n ", maybeHighlight(defs.gutter, gutter.replace(/\d/g, " ")), markerSpacing, maybeHighlight(defs.marker, "^")].join("");
      }
      return [maybeHighlight(defs.marker, ">"), maybeHighlight(defs.gutter, gutter), line, markerLine].join("");
    } else {
      return " " + maybeHighlight(defs.gutter, gutter) + line;
    }
  }).join("\n");

  if (highlighted) {
    return _chalk2.default.reset(frame);
  } else {
    return frame;
  }
};

var _jsTokens = require("js-tokens");

var _jsTokens2 = _interopRequireDefault(_jsTokens);

var _esutils = require("esutils");

var _esutils2 = _interopRequireDefault(_esutils);

var _chalk = require("chalk");

var _chalk2 = _interopRequireDefault(_chalk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var defs = {
  keyword: _chalk2.default.cyan,
  capitalized: _chalk2.default.yellow,
  jsx_tag: _chalk2.default.yellow,
  punctuator: _chalk2.default.yellow,

  number: _chalk2.default.magenta,
  string: _chalk2.default.green,
  regex: _chalk2.default.magenta,
  comment: _chalk2.default.grey,
  invalid: _chalk2.default.white.bgRed.bold,
  gutter: _chalk2.default.grey,
  marker: _chalk2.default.red.bold
};

var NEWLINE = /\r\n|[\n\r\u2028\u2029]/;

var JSX_TAG = /^[a-z][\w-]*$/i;

var BRACKET = /^[()\[\]{}]$/;

function getTokenType(match) {
  var _match$slice = match.slice(-2);

  var offset = _match$slice[0];
  var text = _match$slice[1];

  var token = _jsTokens2.default.matchToToken(match);

  if (token.type === "name") {
    if (_esutils2.default.keyword.isReservedWordES6(token.value)) {
      return "keyword";
    }

    if (JSX_TAG.test(token.value) && (text[offset - 1] === "<" || text.substr(offset - 2, 2) == "</")) {
      return "jsx_tag";
    }

    if (token.value[0] !== token.value[0].toLowerCase()) {
      return "capitalized";
    }
  }

  if (token.type === "punctuator" && BRACKET.test(token.value)) {
    return "bracket";
  }

  return token.type;
}

function highlight(text) {
  return text.replace(_jsTokens2.default, function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var type = getTokenType(args);
    var colorize = defs[type];
    if (colorize) {
      return args[0].split(NEWLINE).map(function (str) {
        return colorize(str);
      }).join("\n");
    } else {
      return args[0];
    }
  });
}

module.exports = exports["default"];