(function() {
  var OldValue, utils;

  utils = require('./utils');

  OldValue = (function() {
    function OldValue(unprefixed, prefixed, string, regexp) {
      this.unprefixed = unprefixed;
      this.prefixed = prefixed;
      this.string = string;
      this.regexp = regexp;
      this.regexp || (this.regexp = utils.regexp(this.prefixed));
      this.string || (this.string = this.prefixed);
    }

    OldValue.prototype.check = function(value) {
      if (value.indexOf(this.string) !== -1) {
        return !!value.match(this.regexp);
      } else {
        return false;
      }
    };

    return OldValue;

  })();

  module.exports = OldValue;

}).call(this);
