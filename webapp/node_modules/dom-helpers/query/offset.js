'use strict';
var contains = require('./contains'),
    getWindow = require('./isWindow'),
    ownerDocument = require('../ownerDocument');

module.exports = function offset(node) {
  var doc = ownerDocument(node),
      win = getWindow(doc),
      docElem = doc && doc.documentElement,
      box = { top: 0, left: 0, height: 0, width: 0 };

  if (!doc) return;

  // Make sure it's not a disconnected DOM node
  if (!contains(docElem, node)) return box;

  if (node.getBoundingClientRect !== undefined) box = node.getBoundingClientRect();

  if (box.width || box.height) {

    box = {
      top: box.top + (win.pageYOffset || docElem.scrollTop) - (docElem.clientTop || 0),
      left: box.left + (win.pageXOffset || docElem.scrollLeft) - (docElem.clientLeft || 0),
      width: (box.width == null ? node.offsetWidth : box.width) || 0,
      height: (box.height == null ? node.offsetHeight : box.height) || 0
    };
  }

  return box;
};