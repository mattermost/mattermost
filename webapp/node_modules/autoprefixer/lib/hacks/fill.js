(function() {
  var Fill, OldValue, Value,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  OldValue = require('../old-value');

  Value = require('../value');

  Fill = (function(superClass) {
    extend(Fill, superClass);

    function Fill() {
      return Fill.__super__.constructor.apply(this, arguments);
    }

    Fill.names = ['fill', 'fill-available'];

    Fill.prototype.replace = function(string, prefix) {
      if (prefix === '-moz-') {
        return string.replace(this.regexp(), '$1-moz-available$3');
      } else if (prefix === '-webkit-') {
        return string.replace(this.regexp(), '$1-webkit-fill-available$3');
      } else {
        return Fill.__super__.replace.apply(this, arguments);
      }
    };

    Fill.prototype.old = function(prefix) {
      if (prefix === '-moz-') {
        return new OldValue(this.name, '-moz-available');
      } else if (prefix === '-webkit-') {
        return new OldValue(this.name, '-webkit-fill-available');
      } else {
        return Fill.__super__.old.apply(this, arguments);
      }
    };

    return Fill;

  })(Value);

  module.exports = Fill;

}).call(this);
