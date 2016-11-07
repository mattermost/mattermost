'use strict';

var contains = require('../query/contains'),
    qsa = require('../query/querySelectorAll');

module.exports = function (selector, handler) {
  return function (e) {
    var top = e.currentTarget,
        target = e.target,
        matches = qsa(top, selector);

    if (matches.some(function (match) {
      return contains(match, target);
    })) handler.call(this, e);
  };
};