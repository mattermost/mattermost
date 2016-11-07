(function() {
  var Declaration, MaskBorder,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  MaskBorder = (function(superClass) {
    extend(MaskBorder, superClass);

    function MaskBorder() {
      return MaskBorder.__super__.constructor.apply(this, arguments);
    }

    MaskBorder.names = ['mask-border', 'mask-border-source', 'mask-border-slice', 'mask-border-width', 'mask-border-outset', 'mask-border-repeat', 'mask-box-image', 'mask-box-image-source', 'mask-box-image-slice', 'mask-box-image-width', 'mask-box-image-outset', 'mask-box-image-repeat'];

    MaskBorder.prototype.normalize = function() {
      return this.name.replace('box-image', 'border');
    };

    MaskBorder.prototype.prefixed = function(prop, prefix) {
      if (prefix === '-webkit-') {
        return MaskBorder.__super__.prefixed.apply(this, arguments).replace('border', 'box-image');
      } else {
        return MaskBorder.__super__.prefixed.apply(this, arguments);
      }
    };

    return MaskBorder;

  })(Declaration);

  module.exports = MaskBorder;

}).call(this);
