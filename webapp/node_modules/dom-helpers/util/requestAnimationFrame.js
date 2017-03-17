'use strict';

var canUseDOM = require('./inDOM');

var vendors = ['', 'webkit', 'moz', 'o', 'ms'],
    cancel = 'clearTimeout',
    raf = fallback,
    compatRaf;

var getKey = function getKey(vendor, k) {
  return vendor + (!vendor ? k : k[0].toUpperCase() + k.substr(1)) + 'AnimationFrame';
};

if (canUseDOM) {
  vendors.some(function (vendor) {
    var rafKey = getKey(vendor, 'request');

    if (rafKey in window) {
      cancel = getKey(vendor, 'cancel');
      return raf = function (cb) {
        return window[rafKey](cb);
      };
    }
  });
}

/* https://github.com/component/raf */
var prev = new Date().getTime();

function fallback(fn) {
  var curr = new Date().getTime(),
      ms = Math.max(0, 16 - (curr - prev)),
      req = setTimeout(fn, ms);

  prev = curr;
  return req;
}

compatRaf = function (cb) {
  return raf(cb);
};
compatRaf.cancel = function (id) {
  return window[cancel](id);
};

module.exports = compatRaf;