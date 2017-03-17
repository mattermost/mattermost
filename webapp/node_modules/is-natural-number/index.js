/*!
 * is-natural-number.js | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/is-natural-number.js
*/
module.exports = (function() {
  'use strict';

  if (Number.isInteger) {
    return function isNaturalNumber(val, zero) {
      return val >= (zero ? 0 : 1) && Number.isInteger(val);
    };
  }

  return function isNaturalNumber(val, zero) {
    return val >= (zero ? 0 : 1) && val !== Infinity && Math.floor(val) === val;
  };
})();
