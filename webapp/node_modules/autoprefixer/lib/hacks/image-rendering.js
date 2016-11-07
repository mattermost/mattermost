(function() {
  var Declaration, ImageRendering,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  ImageRendering = (function(superClass) {
    extend(ImageRendering, superClass);

    function ImageRendering() {
      return ImageRendering.__super__.constructor.apply(this, arguments);
    }

    ImageRendering.names = ['image-rendering', 'interpolation-mode'];

    ImageRendering.prototype.check = function(decl) {
      return decl.value === 'pixelated';
    };

    ImageRendering.prototype.prefixed = function(prop, prefix) {
      if (prefix === '-ms-') {
        return '-ms-interpolation-mode';
      } else {
        return ImageRendering.__super__.prefixed.apply(this, arguments);
      }
    };

    ImageRendering.prototype.set = function(decl, prefix) {
      if (prefix === '-ms-') {
        decl.prop = '-ms-interpolation-mode';
        decl.value = 'nearest-neighbor';
        return decl;
      } else {
        return ImageRendering.__super__.set.apply(this, arguments);
      }
    };

    ImageRendering.prototype.normalize = function(prop) {
      return 'image-rendering';
    };

    ImageRendering.prototype.process = function(node, result) {
      return ImageRendering.__super__.process.apply(this, arguments);
    };

    return ImageRendering;

  })(Declaration);

  module.exports = ImageRendering;

}).call(this);
