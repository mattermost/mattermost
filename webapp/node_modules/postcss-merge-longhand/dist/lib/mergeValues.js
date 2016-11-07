'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

exports['default'] = function () {
  for (var _len = arguments.length, rules = Array(_len), _key = 0; _key < _len; _key++) {
    rules[_key] = arguments[_key];
  }

  return rules.map(function (r) {
    return r.value;
  }).join(' ');
};

module.exports = exports['default'];