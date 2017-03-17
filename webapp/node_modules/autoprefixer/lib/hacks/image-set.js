(function() {
  var ImageSet, Value, list,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  list = require('postcss/lib/list');

  Value = require('../value');

  ImageSet = (function(superClass) {
    extend(ImageSet, superClass);

    function ImageSet() {
      return ImageSet.__super__.constructor.apply(this, arguments);
    }

    ImageSet.names = ['image-set'];

    ImageSet.prototype.replace = function(string, prefix) {
      if (prefix === '-webkit-') {
        return ImageSet.__super__.replace.apply(this, arguments).replace(/("[^"]+"|'[^']+')(\s+\d+\w)/gi, 'url($1)$2');
      } else {
        return ImageSet.__super__.replace.apply(this, arguments);
      }
    };

    return ImageSet;

  })(Value);

  module.exports = ImageSet;

}).call(this);
