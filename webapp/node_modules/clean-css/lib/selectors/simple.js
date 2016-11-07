var cleanUpSelectors = require('./clean-up').selectors;
var cleanUpBlock = require('./clean-up').block;
var cleanUpAtRule = require('./clean-up').atRule;
var split = require('../utils/split');

var RGB = require('../colors/rgb');
var HSL = require('../colors/hsl');
var HexNameShortener = require('../colors/hex-name-shortener');

var wrapForOptimizing = require('../properties/wrap-for-optimizing').all;
var restoreFromOptimizing = require('../properties/restore-from-optimizing');
var removeUnused = require('../properties/remove-unused');

var DEFAULT_ROUNDING_PRECISION = 2;
var CHARSET_TOKEN = '@charset';
var CHARSET_REGEXP = new RegExp('^' + CHARSET_TOKEN, 'i');

var FONT_NUMERAL_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
var FONT_NAME_WEIGHTS = ['normal', 'bold', 'bolder', 'lighter'];
var FONT_NAME_WEIGHTS_WITHOUT_NORMAL = ['bold', 'bolder', 'lighter'];

var WHOLE_PIXEL_VALUE = /(?:^|\s|\()(-?\d+)px/;
var TIME_VALUE = /^(\-?[\d\.]+)(m?s)$/;

var valueMinifiers = {
  'background': function (value, index, total) {
    return index === 0 && total == 1 && (value == 'none' || value == 'transparent') ? '0 0' : value;
  },
  'font-weight': function (value) {
    if (value == 'normal')
      return '400';
    else if (value == 'bold')
      return '700';
    else
      return value;
  },
  'outline': function (value, index, total) {
    return index === 0 && total == 1 && value == 'none' ? '0' : value;
  }
};

function isNegative(property, idx) {
  return property.value[idx] && property.value[idx][0][0] == '-' && parseFloat(property.value[idx][0]) < 0;
}

function zeroMinifier(name, value) {
  if (value.indexOf('0') == -1)
    return value;

  if (value.indexOf('-') > -1) {
    value = value
      .replace(/([^\w\d\-]|^)\-0([^\.]|$)/g, '$10$2')
      .replace(/([^\w\d\-]|^)\-0([^\.]|$)/g, '$10$2');
  }

  return value
    .replace(/(^|\s)0+([1-9])/g, '$1$2')
    .replace(/(^|\D)\.0+(\D|$)/g, '$10$2')
    .replace(/(^|\D)\.0+(\D|$)/g, '$10$2')
    .replace(/\.([1-9]*)0+(\D|$)/g, function (match, nonZeroPart, suffix) {
      return (nonZeroPart.length > 0 ? '.' : '') + nonZeroPart + suffix;
    })
    .replace(/(^|\D)0\.(\d)/g, '$1.$2');
}

function zeroDegMinifier(_, value) {
  if (value.indexOf('0deg') == -1)
    return value;

  return value.replace(/\(0deg\)/g, '(0)');
}

function whitespaceMinifier(name, value) {
  if (name.indexOf('filter') > -1 || value.indexOf(' ') == -1)
    return value;

  value = value.replace(/\s+/g, ' ');

  if (value.indexOf('calc') > -1)
    value = value.replace(/\) ?\/ ?/g, ')/ ');

  return value
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(/, /g, ',');
}

function precisionMinifier(_, value, precisionOptions) {
  if (precisionOptions.value === -1 || value.indexOf('.') === -1)
    return value;

  return value
    .replace(precisionOptions.regexp, function (match, number) {
      return Math.round(parseFloat(number) * precisionOptions.multiplier) / precisionOptions.multiplier + 'px';
    })
    .replace(/(\d)\.($|\D)/g, '$1$2');
}

function unitMinifier(name, value, unitsRegexp) {
  if (/^(?:\-moz\-calc|\-webkit\-calc|calc)\(/.test(value))
    return value;

  if (name == 'flex' || name == '-ms-flex' || name == '-webkit-flex' || name == 'flex-basis' || name == '-webkit-flex-basis')
    return value;

  if (value.indexOf('%') > 0 && (name == 'height' || name == 'max-height'))
    return value;

  return value
    .replace(unitsRegexp, '$1' + '0' + '$2')
    .replace(unitsRegexp, '$1' + '0' + '$2');
}

function multipleZerosMinifier(property) {
  var values = property.value;
  var spliceAt;

  if (values.length == 4 && values[0][0] === '0' && values[1][0] === '0' && values[2][0] === '0' && values[3][0] === '0') {
    if (property.name.indexOf('box-shadow') > -1)
      spliceAt = 2;
    else
      spliceAt = 1;
  }

  if (spliceAt) {
    property.value.splice(spliceAt);
    property.dirty = true;
  }
}

function colorMininifier(name, value, compatibility) {
  if (value.indexOf('#') === -1 && value.indexOf('rgb') == -1 && value.indexOf('hsl') == -1)
    return HexNameShortener.shorten(value);

  value = value
    .replace(/rgb\((\-?\d+),(\-?\d+),(\-?\d+)\)/g, function (match, red, green, blue) {
      return new RGB(red, green, blue).toHex();
    })
    .replace(/hsl\((-?\d+),(-?\d+)%?,(-?\d+)%?\)/g, function (match, hue, saturation, lightness) {
      return new HSL(hue, saturation, lightness).toHex();
    })
    .replace(/(^|[^='"])#([0-9a-f]{6})/gi, function (match, prefix, color) {
      if (color[0] == color[1] && color[2] == color[3] && color[4] == color[5])
        return prefix + '#' + color[0] + color[2] + color[4];
      else
        return prefix + '#' + color;
    })
    .replace(/(rgb|rgba|hsl|hsla)\(([^\)]+)\)/g, function (match, colorFunction, colorDef) {
      var tokens = colorDef.split(',');
      var applies = (colorFunction == 'hsl' && tokens.length == 3) ||
        (colorFunction == 'hsla' && tokens.length == 4) ||
        (colorFunction == 'rgb' && tokens.length == 3 && colorDef.indexOf('%') > 0) ||
        (colorFunction == 'rgba' && tokens.length == 4 && colorDef.indexOf('%') > 0);
      if (!applies)
        return match;

      if (tokens[1].indexOf('%') == -1)
        tokens[1] += '%';
      if (tokens[2].indexOf('%') == -1)
        tokens[2] += '%';
      return colorFunction + '(' + tokens.join(',') + ')';
    });

  if (compatibility.colors.opacity && name.indexOf('background') == -1) {
    value = value.replace(/(?:rgba|hsla)\(0,0%?,0%?,0\)/g, function (match) {
      if (split(value, ',').pop().indexOf('gradient(') > -1)
        return match;

      return 'transparent';
    });
  }

  return HexNameShortener.shorten(value);
}

function pixelLengthMinifier(_, value, compatibility) {
  if (!WHOLE_PIXEL_VALUE.test(value))
    return value;

  return value.replace(WHOLE_PIXEL_VALUE, function (match, val) {
    var newValue;
    var intVal = parseInt(val);

    if (intVal === 0)
      return match;

    if (compatibility.properties.shorterLengthUnits && compatibility.units.pt && intVal * 3 % 4 === 0)
      newValue = intVal * 3 / 4 + 'pt';

    if (compatibility.properties.shorterLengthUnits && compatibility.units.pc && intVal % 16 === 0)
      newValue = intVal / 16 + 'pc';

    if (compatibility.properties.shorterLengthUnits && compatibility.units.in && intVal % 96 === 0)
      newValue = intVal / 96 + 'in';

    if (newValue)
      newValue = match.substring(0, match.indexOf(val)) + newValue;

    return newValue && newValue.length < match.length ? newValue : match;
  });
}

function timeUnitMinifier(_, value) {
  if (!TIME_VALUE.test(value))
    return value;

  return value.replace(TIME_VALUE, function (match, val, unit) {
    var newValue;

    if (unit == 'ms') {
      newValue = parseInt(val) / 1000 + 's';
    } else if (unit == 's') {
      newValue = parseFloat(val) * 1000 + 'ms';
    }

    return newValue.length < match.length ? newValue : match;
  });
}

function minifyBorderRadius(property) {
  var values = property.value;
  var spliceAt;

  if (values.length == 3 && values[1][0] == '/' && values[0][0] == values[2][0])
    spliceAt = 1;
  else if (values.length == 5 && values[2][0] == '/' && values[0][0] == values[3][0] && values[1][0] == values[4][0])
    spliceAt = 2;
  else if (values.length == 7 && values[3][0] == '/' && values[0][0] == values[4][0] && values[1][0] == values[5][0] && values[2][0] == values[6][0])
    spliceAt = 3;
  else if (values.length == 9 && values[4][0] == '/' && values[0][0] == values[5][0] && values[1][0] == values[6][0] && values[2][0] == values[7][0] && values[3][0] == values[8][0])
    spliceAt = 4;

  if (spliceAt) {
    property.value.splice(spliceAt);
    property.dirty = true;
  }
}

function minifyFilter(property) {
  if (property.value.length == 1) {
    property.value[0][0] = property.value[0][0].replace(/progid:DXImageTransform\.Microsoft\.(Alpha|Chroma)(\W)/, function (match, filter, suffix) {
      return filter.toLowerCase() + suffix;
    });
  }

  property.value[0][0] = property.value[0][0]
    .replace(/,(\S)/g, ', $1')
    .replace(/ ?= ?/g, '=');
}

function minifyFont(property) {
  var values = property.value;
  var hasNumeral = FONT_NUMERAL_WEIGHTS.indexOf(values[0][0]) > -1 ||
    values[1] && FONT_NUMERAL_WEIGHTS.indexOf(values[1][0]) > -1 ||
    values[2] && FONT_NUMERAL_WEIGHTS.indexOf(values[2][0]) > -1;

  if (hasNumeral)
    return;

  if (values[1] == '/')
    return;

  var normalCount = 0;
  if (values[0][0] == 'normal')
    normalCount++;
  if (values[1] && values[1][0] == 'normal')
    normalCount++;
  if (values[2] && values[2][0] == 'normal')
    normalCount++;

  if (normalCount > 1)
    return;

  var toOptimize;
  if (FONT_NAME_WEIGHTS_WITHOUT_NORMAL.indexOf(values[0][0]) > -1)
    toOptimize = 0;
  else if (values[1] && FONT_NAME_WEIGHTS_WITHOUT_NORMAL.indexOf(values[1][0]) > -1)
    toOptimize = 1;
  else if (values[2] && FONT_NAME_WEIGHTS_WITHOUT_NORMAL.indexOf(values[2][0]) > -1)
    toOptimize = 2;
  else if (FONT_NAME_WEIGHTS.indexOf(values[0][0]) > -1)
    toOptimize = 0;
  else if (values[1] && FONT_NAME_WEIGHTS.indexOf(values[1][0]) > -1)
    toOptimize = 1;
  else if (values[2] && FONT_NAME_WEIGHTS.indexOf(values[2][0]) > -1)
    toOptimize = 2;

  if (toOptimize !== undefined) {
    property.value[toOptimize][0] = valueMinifiers['font-weight'](values[toOptimize][0]);
    property.dirty = true;
  }
}

function optimizeBody(properties, options) {
  var property, name, value;
  var _properties = wrapForOptimizing(properties);

  for (var i = 0, l = _properties.length; i < l; i++) {
    property = _properties[i];
    name = property.name;

    if (property.hack && (
        (property.hack == 'star' || property.hack == 'underscore') && !options.compatibility.properties.iePrefixHack ||
        property.hack == 'backslash' && !options.compatibility.properties.ieSuffixHack ||
        property.hack == 'bang' && !options.compatibility.properties.ieBangHack))
      property.unused = true;

    if (name.indexOf('padding') === 0 && (isNegative(property, 0) || isNegative(property, 1) || isNegative(property, 2) || isNegative(property, 3)))
      property.unused = true;

    if (property.unused)
      continue;

    if (property.variable) {
      if (property.block)
        optimizeBody(property.value[0], options);
      continue;
    }

    for (var j = 0, m = property.value.length; j < m; j++) {
      value = property.value[j][0];

      if (valueMinifiers[name])
        value = valueMinifiers[name](value, j, m);

      value = whitespaceMinifier(name, value);
      value = precisionMinifier(name, value, options.precision);
      value = pixelLengthMinifier(name, value, options.compatibility);
      value = timeUnitMinifier(name, value);
      value = zeroMinifier(name, value);
      if (options.compatibility.properties.zeroUnits) {
        value = zeroDegMinifier(name, value);
        value = unitMinifier(name, value, options.unitsRegexp);
      }
      if (options.compatibility.properties.colors)
        value = colorMininifier(name, value, options.compatibility);

      property.value[j][0] = value;
    }

    multipleZerosMinifier(property);

    if (name.indexOf('border') === 0 && name.indexOf('radius') > 0)
      minifyBorderRadius(property);
    else if (name == 'filter')
      minifyFilter(property);
    else if (name == 'font')
      minifyFont(property);
  }

  restoreFromOptimizing(_properties, true);
  removeUnused(_properties);
}

function cleanupCharsets(tokens) {
  var hasCharset = false;

  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];

    if (token[0] != 'at-rule')
      continue;

    if (!CHARSET_REGEXP.test(token[1][0]))
      continue;

    if (hasCharset || token[1][0].indexOf(CHARSET_TOKEN) == -1) {
      tokens.splice(i, 1);
      i--;
      l--;
    } else {
      hasCharset = true;
      tokens.splice(i, 1);
      tokens.unshift(['at-rule', [token[1][0].replace(CHARSET_REGEXP, CHARSET_TOKEN)]]);
    }
  }
}

function buildUnitRegexp(options) {
  var units = ['px', 'em', 'ex', 'cm', 'mm', 'in', 'pt', 'pc', '%'];
  var otherUnits = ['ch', 'rem', 'vh', 'vm', 'vmax', 'vmin', 'vw'];

  otherUnits.forEach(function (unit) {
    if (options.compatibility.units[unit])
      units.push(unit);
  });

  return new RegExp('(^|\\s|\\(|,)0(?:' + units.join('|') + ')(\\W|$)', 'g');
}

function buildPrecision(options) {
  var precision = {};

  precision.value = options.roundingPrecision === undefined ?
    DEFAULT_ROUNDING_PRECISION :
    options.roundingPrecision;
  precision.multiplier = Math.pow(10, precision.value);
  precision.regexp = new RegExp('(\\d*\\.\\d{' + (precision.value + 1) + ',})px', 'g');

  return precision;
}

function optimize(tokens, options) {
  var ie7Hack = options.compatibility.selectors.ie7Hack;
  var adjacentSpace = options.compatibility.selectors.adjacentSpace;
  var spaceAfterClosingBrace = options.compatibility.properties.spaceAfterClosingBrace;
  var mayHaveCharset = false;

  options.unitsRegexp = buildUnitRegexp(options);
  options.precision = buildPrecision(options);

  for (var i = 0, l = tokens.length; i < l; i++) {
    var token = tokens[i];

    switch (token[0]) {
      case 'selector':
        token[1] = cleanUpSelectors(token[1], !ie7Hack, adjacentSpace);
        optimizeBody(token[2], options);
        break;
      case 'block':
        cleanUpBlock(token[1], spaceAfterClosingBrace);
        optimize(token[2], options);
        break;
      case 'flat-block':
        cleanUpBlock(token[1], spaceAfterClosingBrace);
        optimizeBody(token[2], options);
        break;
      case 'at-rule':
        cleanUpAtRule(token[1]);
        mayHaveCharset = true;
    }

    if (token[1].length === 0 || (token[2] && token[2].length === 0)) {
      tokens.splice(i, 1);
      i--;
      l--;
    }
  }

  if (mayHaveCharset)
    cleanupCharsets(tokens);
}

module.exports = optimize;
