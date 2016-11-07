(function() {
  var FilterValue, OldFilterValue, OldValue, Value, utils,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  OldValue = require('../old-value');

  Value = require('../value');

  utils = require('../utils');

  OldFilterValue = (function(superClass) {
    extend(OldFilterValue, superClass);

    function OldFilterValue() {
      return OldFilterValue.__super__.constructor.apply(this, arguments);
    }

    OldFilterValue.prototype.clean = function(decl) {
      return decl.value = utils.editList(decl.value, (function(_this) {
        return function(props) {
          if (props.every(function(i) {
            return i.indexOf(_this.unprefixed) !== 0;
          })) {
            return props;
          }
          return props.filter(function(i) {
            return i.indexOf(_this.prefixed) === -1;
          });
        };
      })(this));
    };

    return OldFilterValue;

  })(OldValue);

  FilterValue = (function(superClass) {
    extend(FilterValue, superClass);

    FilterValue.names = ['filter', 'filter-function'];

    function FilterValue(name, prefixes) {
      FilterValue.__super__.constructor.apply(this, arguments);
      if (name === 'filter-function') {
        this.name = 'filter';
      }
    }

    FilterValue.prototype.replace = function(value, prefix) {
      if (prefix === '-webkit-' && value.indexOf('filter(') === -1) {
        if (value.indexOf('-webkit-filter') === -1) {
          return FilterValue.__super__.replace.apply(this, arguments) + ', ' + value;
        } else {
          return value;
        }
      } else {
        return FilterValue.__super__.replace.apply(this, arguments);
      }
    };

    FilterValue.prototype.old = function(prefix) {
      return new OldFilterValue(this.name, prefix + this.name);
    };

    return FilterValue;

  })(Value);

  module.exports = FilterValue;

}).call(this);
