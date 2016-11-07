var split = require('../utils/split');

var COMMA = ',';
var FORWARD_SLASH = '/';

var AT_RULE = 'at-rule';

var IMPORTANT_WORD = 'important';
var IMPORTANT_TOKEN = '!'+IMPORTANT_WORD;
var IMPORTANT_WORD_MATCH = new RegExp('^'+IMPORTANT_WORD+'$', 'i');
var IMPORTANT_TOKEN_MATCH = new RegExp('^'+IMPORTANT_TOKEN+'$', 'i');

function selectorName(value) {
  return value[0];
}

function noop() {}

function withoutComments(string, into, heading, context) {
  var matcher = heading ? /^__ESCAPED_COMMENT_/ : /__ESCAPED_COMMENT_/;
  var track = heading ? context.track : noop; // don't track when comment not in a heading as we do it later in `trackComments`

  while (matcher.test(string)) {
    var startOfComment = string.indexOf('__');
    var endOfComment = string.indexOf('__', startOfComment + 1) + 2;
    var comment = string.substring(startOfComment, endOfComment);
    string = string.substring(0, startOfComment) + string.substring(endOfComment);

    track(comment);
    into.push(comment);
  }

  return string;
}

function withoutHeadingComments(string, into, context) {
  return withoutComments(string, into, true, context);
}

function withoutInnerComments(string, into, context) {
  return withoutComments(string, into, false, context);
}

function trackComments(comments, into, context) {
  for (var i = 0, l = comments.length; i < l; i++) {
    context.track(comments[i]);
    into.push(comments[i]);
  }
}

function extractProperties(string, selectors, context) {
  var list = [];
  var innerComments = [];
  var valueSeparator = /[ ,\/]/;

  if (typeof string != 'string')
    return [];

  if (string.indexOf(')') > -1)
    string = string.replace(/\)([^\s_;:,\)])/g, context.sourceMap ? ') __ESCAPED_COMMENT_CLEAN_CSS(0,-1)__ $1' : ') $1');

  if (string.indexOf('ESCAPED_URL_CLEAN_CSS') > -1)
    string = string.replace(/(ESCAPED_URL_CLEAN_CSS[^_]+?__)/g, context.sourceMap ? '$1 __ESCAPED_COMMENT_CLEAN_CSS(0,-1)__ ' : '$1 ');

  var candidates = split(string, ';', false, '{', '}');

  for (var i = 0, l = candidates.length; i < l; i++) {
    var candidate = candidates[i];
    var firstColonAt = candidate.indexOf(':');

    var atRule = candidate.trim()[0] == '@';
    if (atRule) {
      context.track(candidate);
      list.push([AT_RULE, candidate.trim()]);
      continue;
    }

    if (firstColonAt == -1) {
      context.track(candidate);
      if (candidate.indexOf('__ESCAPED_COMMENT_SPECIAL') > -1)
        list.push(candidate.trim());
      continue;
    }

    if (candidate.indexOf('{') > 0 && candidate.indexOf('{') < firstColonAt) {
      context.track(candidate);
      continue;
    }

    var body = [];
    var name = candidate.substring(0, firstColonAt);

    innerComments = [];

    if (name.indexOf('__ESCAPED_COMMENT') > -1)
      name = withoutHeadingComments(name, list, context);

    if (name.indexOf('__ESCAPED_COMMENT') > -1)
      name = withoutInnerComments(name, innerComments, context);

    body.push([name.trim()].concat(context.track(name, true)));
    context.track(':');

    trackComments(innerComments, list, context);

    var firstBraceAt = candidate.indexOf('{');
    var isVariable = name.trim().indexOf('--') === 0;
    if (isVariable && firstBraceAt > 0) {
      var blockPrefix = candidate.substring(firstColonAt + 1, firstBraceAt + 1);
      var blockSuffix = candidate.substring(candidate.indexOf('}'));
      var blockContent = candidate.substring(firstBraceAt + 1, candidate.length - blockSuffix.length);

      context.track(blockPrefix);
      body.push(extractProperties(blockContent, selectors, context));
      list.push(body);
      context.track(blockSuffix);
      context.track(i < l - 1 ? ';' : '');

      continue;
    }

    var values = split(candidate.substring(firstColonAt + 1), valueSeparator, true);

    if (values.length == 1 && values[0] === '') {
      context.warnings.push('Empty property \'' + name + '\' inside \'' + selectors.filter(selectorName).join(',') + '\' selector. Ignoring.');
      continue;
    }

    for (var j = 0, m = values.length; j < m; j++) {
      var value = values[j];
      var trimmed = value.trim();

      if (trimmed.length === 0)
        continue;

      var lastCharacter = trimmed[trimmed.length - 1];
      var endsWithNonSpaceSeparator = trimmed.length > 1 && (lastCharacter == COMMA || lastCharacter == FORWARD_SLASH);

      if (endsWithNonSpaceSeparator)
        trimmed = trimmed.substring(0, trimmed.length - 1);

      if (trimmed.indexOf('__ESCAPED_COMMENT_CLEAN_CSS(0,-') > -1) {
        context.track(trimmed);
        continue;
      }

      innerComments = [];

      if (trimmed.indexOf('__ESCAPED_COMMENT') > -1)
        trimmed = withoutHeadingComments(trimmed, list, context);

      if (trimmed.indexOf('__ESCAPED_COMMENT') > -1)
        trimmed = withoutInnerComments(trimmed, innerComments, context);

      if (trimmed.length === 0) {
        trackComments(innerComments, list, context);
        continue;
      }

      var pos = body.length - 1;
      if (IMPORTANT_WORD_MATCH.test(trimmed) && body[pos][0] == '!') {
        context.track(trimmed);
        body[pos - 1][0] += IMPORTANT_TOKEN;
        body.pop();
        continue;
      }

      if (IMPORTANT_TOKEN_MATCH.test(trimmed) || (IMPORTANT_WORD_MATCH.test(trimmed) && body[pos][0][body[pos][0].length - 1] == '!')) {
        context.track(trimmed);
        body[pos][0] += trimmed;
        continue;
      }

      body.push([trimmed].concat(context.track(value, true)));

      trackComments(innerComments, list, context);

      if (endsWithNonSpaceSeparator) {
        body.push([lastCharacter]);
        context.track(lastCharacter);
      }
    }

    if (i < l - 1)
      context.track(';');

    list.push(body);
  }

  return list;
}

module.exports = extractProperties;
