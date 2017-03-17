(function() {
  var Declaration, WritingMode,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  WritingMode = (function(superClass) {
    extend(WritingMode, superClass);

    function WritingMode() {
      return WritingMode.__super__.constructor.apply(this, arguments);
    }

    WritingMode.names = ['writing-mode'];

    WritingMode.msValues = {
      'horizontal-tb': 'lr-tb',
      'vertical-rl': 'tb-rl',
      'vertical-lr': 'tb-lr'
    };

    WritingMode.prototype.set = function(decl, prefix) {
      if (prefix === '-ms-') {
        decl.value = WritingMode.msValues[decl.value] || decl.value;
        return WritingMode.__super__.set.call(this, decl, prefix);
      } else {
        return WritingMode.__super__.set.apply(this, arguments);
      }
    };

    return WritingMode;

  })(Declaration);

  module.exports = WritingMode;

}).call(this);
