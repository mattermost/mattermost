(function() {
  var Declaration, TextEmphasisPosition,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  TextEmphasisPosition = (function(superClass) {
    extend(TextEmphasisPosition, superClass);

    function TextEmphasisPosition() {
      return TextEmphasisPosition.__super__.constructor.apply(this, arguments);
    }

    TextEmphasisPosition.names = ['text-emphasis-position'];

    TextEmphasisPosition.prototype.set = function(decl, prefix) {
      if (prefix === '-webkit-') {
        decl.value = decl.value.replace(/\s*(right|left)\s*/i, '');
        return TextEmphasisPosition.__super__.set.call(this, decl, prefix);
      } else {
        return TextEmphasisPosition.__super__.set.apply(this, arguments);
      }
    };

    return TextEmphasisPosition;

  })(Declaration);

  module.exports = TextEmphasisPosition;

}).call(this);
