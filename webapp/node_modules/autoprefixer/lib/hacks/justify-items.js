(function() {
  var Declaration, JustifyItems,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  JustifyItems = (function(superClass) {
    extend(JustifyItems, superClass);

    function JustifyItems() {
      return JustifyItems.__super__.constructor.apply(this, arguments);
    }

    JustifyItems.names = ['justify-items', 'grid-column-align'];

    JustifyItems.prototype.prefixed = function(prop, prefix) {
      return prefix + (prefix === '-ms-' ? 'grid-column-align' : prop);
    };

    JustifyItems.prototype.normalize = function(prop) {
      return 'justify-items';
    };

    return JustifyItems;

  })(Declaration);

  module.exports = JustifyItems;

}).call(this);
