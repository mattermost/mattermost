var BACKSLASH_HACK = '\\';
var IMPORTANT_WORD = 'important';
var IMPORTANT_TOKEN = '!'+IMPORTANT_WORD;
var IMPORTANT_WORD_MATCH = new RegExp(IMPORTANT_WORD+'$', 'i');
var IMPORTANT_TOKEN_MATCH = new RegExp(IMPORTANT_TOKEN+'$', 'i');
var STAR_HACK = '*';
var UNDERSCORE_HACK = '_';
var BANG_HACK = '!';

function wrapAll(properties) {
  var wrapped = [];

  for (var i = properties.length - 1; i >= 0; i--) {
    if (typeof properties[i][0] == 'string')
      continue;

    var single = wrapSingle(properties[i]);
    single.all = properties;
    single.position = i;
    wrapped.unshift(single);
  }

  return wrapped;
}

function isMultiplex(property) {
  for (var i = 1, l = property.length; i < l; i++) {
    if (property[i][0] == ',' || property[i][0] == '/')
      return true;
  }

  return false;
}

function hackType(property) {
  var type = false;
  var name = property[0][0];
  var lastValue = property[property.length - 1];

  if (name[0] == UNDERSCORE_HACK) {
    type = 'underscore';
  } else if (name[0] == STAR_HACK) {
    type = 'star';
  } else if (lastValue[0][0] == BANG_HACK && !lastValue[0].match(IMPORTANT_WORD_MATCH)) {
    type = 'bang';
  } else if (lastValue[0].indexOf(BANG_HACK) > 0 && !lastValue[0].match(IMPORTANT_WORD_MATCH)) {
    type = 'bang';
  } else if (lastValue[0].indexOf(BACKSLASH_HACK) > 0 && lastValue[0].indexOf(BACKSLASH_HACK) == lastValue[0].length - BACKSLASH_HACK.length - 1) {
    type = 'backslash';
  } else if (lastValue[0].indexOf(BACKSLASH_HACK) === 0 && lastValue[0].length == 2) {
    type = 'backslash';
  }

  return type;
}

function isImportant(property) {
  if (property.length > 1) {
    var p = property[property.length - 1][0];
    if (typeof(p) === 'string') {
      return IMPORTANT_TOKEN_MATCH.test(p);
    }
  }
  return false;
}

function stripImportant(property) {
  if (property.length > 0)
    property[property.length - 1][0] = property[property.length - 1][0].replace(IMPORTANT_TOKEN_MATCH, '');
}

function stripPrefixHack(property) {
  property[0][0] = property[0][0].substring(1);
}

function stripSuffixHack(property, hackType) {
  var lastValue = property[property.length - 1];
  lastValue[0] = lastValue[0]
    .substring(0, lastValue[0].indexOf(hackType == 'backslash' ? BACKSLASH_HACK : BANG_HACK))
    .trim();

  if (lastValue[0].length === 0)
    property.pop();
}

function wrapSingle(property) {
  var _isImportant = isImportant(property);
  if (_isImportant)
    stripImportant(property);

  var _hackType = hackType(property);
  if (_hackType == 'star' || _hackType == 'underscore')
    stripPrefixHack(property);
  else if (_hackType == 'backslash' || _hackType == 'bang')
    stripSuffixHack(property, _hackType);

  var isVariable = property[0][0].indexOf('--') === 0;

  return {
    block: isVariable && property[1] && Array.isArray(property[1][0][0]),
    components: [],
    dirty: false,
    hack: _hackType,
    important: _isImportant,
    name: property[0][0],
    multiplex: property.length > 2 ? isMultiplex(property) : false,
    position: 0,
    shorthand: false,
    unused: property.length < 2,
    value: property.slice(1),
    variable: isVariable
  };
}

module.exports = {
  all: wrapAll,
  single: wrapSingle
};
