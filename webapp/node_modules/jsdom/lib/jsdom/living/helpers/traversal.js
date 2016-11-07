"use strict";
const domSymbolTree = require("./internal-constants").domSymbolTree;

// All these operate on and return impls, not wrappers!

exports.closest = (e, localName) => {
  while (e) {
    if (e.localName === localName) {
      return e;
    }
    e = domSymbolTree.parent(e);
  }

  return null;
};

exports.childrenByHTMLLocalName = (parent, localName) => {
  return domSymbolTree.childrenToArray(parent, { filter(node) {
    return node._localName === localName && node._namespaceURI === "http://www.w3.org/1999/xhtml";
  } });
};

exports.descendantsByHTMLLocalName = (parent, localName) => {
  return domSymbolTree.treeToArray(parent, { filter(node) {
    return node._localName === localName && node._namespaceURI === "http://www.w3.org/1999/xhtml" && node !== parent;
  } });
};

exports.childrenByHTMLLocalNames = (parent, localNamesSet) => {
  return domSymbolTree.childrenToArray(parent, { filter(node) {
    return localNamesSet.has(node._localName) && node._namespaceURI === "http://www.w3.org/1999/xhtml";
  } });
};

exports.descendantsByHTMLLocalNames = (parent, localNamesSet) => {
  return domSymbolTree.treeToArray(parent, { filter(node) {
    return localNamesSet.has(node._localName) &&
           node._namespaceURI === "http://www.w3.org/1999/xhtml" &&
           node !== parent;
  } });
};

exports.firstChildWithHTMLLocalName = (parent, localName) => {
  const iterator = domSymbolTree.childrenIterator(parent);
  for (const child of iterator) {
    if (child._localName === localName && child._namespaceURI === "http://www.w3.org/1999/xhtml") {
      return child;
    }
  }
  return null;
};
