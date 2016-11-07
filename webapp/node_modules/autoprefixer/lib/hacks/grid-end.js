(function() {
  var Declaration, GridEnd,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  GridEnd = (function(superClass) {
    extend(GridEnd, superClass);

    function GridEnd() {
      return GridEnd.__super__.constructor.apply(this, arguments);
    }

    GridEnd.names = ['grid-row-end', 'grid-column-end', 'grid-row-span', 'grid-column-span'];

    GridEnd.prototype.check = function(decl) {
      return decl.value.indexOf('span') !== -1;
    };

    GridEnd.prototype.normalize = function(prop) {
      return prop.replace(/(-span|-end)/, '');
    };

    GridEnd.prototype.prefixed = function(prop, prefix) {
      if (prefix === '-ms-') {
        return prefix + prop.replace('-end', '-span');
      } else {
        return GridEnd.__super__.prefixed.call(this, prop, prefix);
      }
    };

    GridEnd.prototype.set = function(decl, prefix) {
      if (prefix === '-ms-') {
        decl.value = decl.value.replace(/span\s/i, '');
      }
      return GridEnd.__super__.set.call(this, decl, prefix);
    };

    return GridEnd;

  })(Declaration);

  module.exports = GridEnd;

}).call(this);
