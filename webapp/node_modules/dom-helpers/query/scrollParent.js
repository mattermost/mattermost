'use strict';

var css = require('../style'),
    height = require('./height');

module.exports = function scrollPrarent(node) {
  var position = css(node, 'position'),
      excludeStatic = position === 'absolute',
      ownerDoc = node.ownerDocument;

  if (position === 'fixed') return ownerDoc || document;

  while ((node = node.parentNode) && node.nodeType !== 9) {

    var isStatic = excludeStatic && css(node, 'position') === 'static',
        style = css(node, 'overflow') + css(node, 'overflow-y') + css(node, 'overflow-x');

    if (isStatic) continue;

    if (/(auto|scroll)/.test(style) && height(node) < node.scrollHeight) return node;
  }

  return document;
};