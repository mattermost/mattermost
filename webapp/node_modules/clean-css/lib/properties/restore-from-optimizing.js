var compactable = require('./compactable');

var BACKSLASH_HACK = '\\9';
var IMPORTANT_TOKEN = '!important';
var STAR_HACK = '*';
var UNDERSCORE_HACK = '_';
var BANG_HACK = '!ie';

function restoreImportant(property) {
  property.value[property.value.length - 1][0] += IMPORTANT_TOKEN;
}

function restoreHack(property) {
  if (property.hack == 'underscore')
    property.name = UNDERSCORE_HACK + property.name;
  else if (property.hack == 'star')
    property.name = STAR_HACK + property.name;
  else if (property.hack == 'backslash')
    property.value[property.value.length - 1][0] += BACKSLASH_HACK;
  else if (property.hack == 'bang')
    property.value[property.value.length - 1][0] += ' ' + BANG_HACK;
}

function restoreFromOptimizing(properties, simpleMode) {
  for (var i = properties.length - 1; i >= 0; i--) {
    var property = properties[i];
    var descriptor = compactable[property.name];
    var restored;

    if (property.unused)
      continue;

    if (!property.dirty && !property.important && !property.hack)
      continue;

    if (!simpleMode && descriptor && descriptor.shorthand) {
      restored = descriptor.restore(property, compactable);
      property.value = restored;
    } else {
      restored = property.value;
    }

    if (property.important)
      restoreImportant(property);

    if (property.hack)
      restoreHack(property);

    if (!('all' in property))
      continue;

    var current = property.all[property.position];
    current[0][0] = property.name;

    current.splice(1, current.length - 1);
    Array.prototype.push.apply(current, restored);
  }
}

module.exports = restoreFromOptimizing;
