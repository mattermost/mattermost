"use strict";

const CharacterDataImpl = require("./CharacterData-impl").implementation;

const domSymbolTree = require("../helpers/internal-constants").domSymbolTree;
const DOMException = require("../../web-idl/DOMException");
const NODE_TYPE = require("../node-type");

class TextImpl extends CharacterDataImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this.nodeType = NODE_TYPE.TEXT_NODE;
  }

  splitText(offset) {
    offset >>>= 0;

    const length = this.length;

    if (offset > length) {
      throw new DOMException(DOMException.INDEX_SIZE_ERR);
    }

    const count = length - offset;
    const newData = this.substringData(offset, count);

    const newNode = this._ownerDocument.createTextNode(newData);

    const parent = domSymbolTree.parent(this);

    if (parent !== null) {
      parent.insertBefore(newNode, this.nextSibling);
    }

    this.replaceData(offset, count, "");

    return newNode;

    // TODO: range stuff
  }

  // TODO: wholeText property
}

module.exports = {
  implementation: TextImpl
};
