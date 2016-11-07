(function() {
  var FlexValues, OldValue, Value,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  OldValue = require('../old-value');

  Value = require('../value');

  FlexValues = (function(superClass) {
    extend(FlexValues, superClass);

    function FlexValues() {
      return FlexValues.__super__.constructor.apply(this, arguments);
    }

    FlexValues.names = ['flex', 'flex-grow', 'flex-shrink', 'flex-basis'];

    FlexValues.prototype.prefixed = function(prefix) {
      return this.all.prefixed(this.name, prefix);
    };

    FlexValues.prototype.replace = function(string, prefix) {
      return string.replace(this.regexp(), '$1' + this.prefixed(prefix) + '$3');
    };

    FlexValues.prototype.old = function(prefix) {
      return new OldValue(this.name, this.prefixed(prefix));
    };

    return FlexValues;

  })(Value);

  module.exports = FlexValues;

}).call(this);
