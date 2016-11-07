(function() {
  var BlockLogical, Declaration,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  BlockLogical = (function(superClass) {
    extend(BlockLogical, superClass);

    function BlockLogical() {
      return BlockLogical.__super__.constructor.apply(this, arguments);
    }

    BlockLogical.names = ['border-block-start', 'border-block-end', 'margin-block-start', 'margin-block-end', 'padding-block-start', 'padding-block-end', 'border-before', 'border-after', 'margin-before', 'margin-after', 'padding-before', 'padding-after'];

    BlockLogical.prototype.prefixed = function(prop, prefix) {
      return prefix + (prop.indexOf('-start') !== -1 ? prop.replace('-block-start', '-before') : prop.replace('-block-end', '-after'));
    };

    BlockLogical.prototype.normalize = function(prop) {
      if (prop.indexOf('-before') !== -1) {
        return prop.replace('-before', '-block-start');
      } else {
        return prop.replace('-after', '-block-end');
      }
    };

    return BlockLogical;

  })(Declaration);

  module.exports = BlockLogical;

}).call(this);
