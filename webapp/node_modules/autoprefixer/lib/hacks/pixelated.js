(function() {
  var OldValue, Pixelated, Value,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  OldValue = require('../old-value');

  Value = require('../value');

  Pixelated = (function(superClass) {
    extend(Pixelated, superClass);

    function Pixelated() {
      return Pixelated.__super__.constructor.apply(this, arguments);
    }

    Pixelated.names = ['pixelated'];

    Pixelated.prototype.replace = function(string, prefix) {
      if (prefix === '-webkit-') {
        return string.replace(this.regexp(), '$1-webkit-optimize-contrast');
      } else if (prefix === '-moz-') {
        return string.replace(this.regexp(), '$1-moz-crisp-edges');
      } else {
        return Pixelated.__super__.replace.apply(this, arguments);
      }
    };

    Pixelated.prototype.old = function(prefix) {
      if (prefix === '-webkit-') {
        return new OldValue(this.name, '-webkit-optimize-contrast');
      } else if (prefix === '-moz-') {
        return new OldValue(this.name, '-moz-crisp-edges');
      } else {
        return Pixelated.__super__.old.apply(this, arguments);
      }
    };

    return Pixelated;

  })(Value);

  module.exports = Pixelated;

}).call(this);
