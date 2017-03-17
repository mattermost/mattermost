(function() {
  var Declaration, GridStart,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  GridStart = (function(superClass) {
    extend(GridStart, superClass);

    function GridStart() {
      return GridStart.__super__.constructor.apply(this, arguments);
    }

    GridStart.names = ['grid-row-start', 'grid-column-start', 'grid-row', 'grid-column'];

    GridStart.prototype.check = function(decl) {
      return decl.value.indexOf('/') === -1 || decl.value.indexOf('span') !== -1;
    };

    GridStart.prototype.normalize = function(prop) {
      return prop.replace('-start', '');
    };

    GridStart.prototype.prefixed = function(prop, prefix) {
      if (prefix === '-ms-') {
        return prefix + prop.replace('-start', '');
      } else {
        return GridStart.__super__.prefixed.call(this, prop, prefix);
      }
    };

    GridStart.prototype.insert = function(decl, prefix, prefixes) {
      var parts;
      parts = this.splitValue(decl, prefix);
      if (parts.length === 2) {
        decl.cloneBefore({
          prop: '-ms-' + decl.prop + '-span',
          value: parts[1]
        });
      }
      return GridStart.__super__.insert.call(this, decl, prefix, prefixes);
    };

    GridStart.prototype.set = function(decl, prefix) {
      var parts;
      parts = this.splitValue(decl, prefix);
      if (parts.length === 2) {
        decl.value = parts[0];
      }
      return GridStart.__super__.set.call(this, decl, prefix);
    };

    GridStart.prototype.splitValue = function(decl, prefix) {
      var parts;
      if (prefix === '-ms-' && decl.prop.indexOf('-start') === -1) {
        parts = decl.value.split(/\s*\/\s*span\s+/);
        if (parts.length === 2) {
          return parts;
        }
      }
      return false;
    };

    return GridStart;

  })(Declaration);

  module.exports = GridStart;

}).call(this);
