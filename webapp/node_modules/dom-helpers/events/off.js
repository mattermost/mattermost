'use strict';
var canUseDOM = require('../util/inDOM');
var off = function off() {};

if (canUseDOM) {

  off = (function () {

    if (document.addEventListener) return function (node, eventName, handler, capture) {
      return node.removeEventListener(eventName, handler, capture || false);
    };else if (document.attachEvent) return function (node, eventName, handler) {
      return node.detachEvent('on' + eventName, handler);
    };
  })();
}

module.exports = off;