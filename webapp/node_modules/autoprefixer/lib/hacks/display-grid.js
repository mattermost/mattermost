(function() {
  var DisplayGrid, OldValue, Value, flexSpec,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  flexSpec = require('./flex-spec');

  OldValue = require('../old-value');

  Value = require('../value');

  DisplayGrid = (function(superClass) {
    extend(DisplayGrid, superClass);

    DisplayGrid.names = ['display-grid', 'inline-grid'];

    function DisplayGrid(name, prefixes) {
      DisplayGrid.__super__.constructor.apply(this, arguments);
      if (name === 'display-grid') {
        this.name = 'grid';
      }
    }

    DisplayGrid.prototype.check = function(decl) {
      return decl.prop === 'display' && decl.value === this.name;
    };

    return DisplayGrid;

  })(Value);

  module.exports = DisplayGrid;

}).call(this);
