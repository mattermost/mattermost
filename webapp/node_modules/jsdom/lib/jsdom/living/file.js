"use strict";

const fileSymbols = require("./file-symbols");
const Blob = require("./blob");

module.exports = class File extends Blob {
  constructor(fileBits, fileName) {
    super(fileBits, arguments[2]);
    if (!(this instanceof File)) {
      throw new TypeError("DOM object constructor cannot be called as a function.");
    }
    this[fileSymbols.name] = fileName.replace(/\//g, ":");
  }
  get name() {
    return this[fileSymbols.name];
  }
};
