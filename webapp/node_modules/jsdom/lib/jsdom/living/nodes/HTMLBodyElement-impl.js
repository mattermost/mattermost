"use strict";

const HTMLElementImpl = require("./HTMLElement-impl").implementation;

const defineGetter = require("../../utils").defineGetter;
const defineSetter = require("../../utils").defineSetter;
const proxiedWindowEventHandlers = require("../helpers/proxied-window-event-handlers");

class HTMLBodyElementImpl extends HTMLElementImpl {

}

(function () {
  proxiedWindowEventHandlers.forEach(name => {
    defineSetter(HTMLBodyElementImpl.prototype, name, function (handler) {
      const window = this._ownerDocument._defaultView;
      if (window) {
        window[name] = handler;
      }
    });
    defineGetter(HTMLBodyElementImpl.prototype, name, function () {
      const window = this._ownerDocument._defaultView;
      return window ? window[name] : null;
    });
  });
}());

module.exports = {
  implementation: HTMLBodyElementImpl
};
