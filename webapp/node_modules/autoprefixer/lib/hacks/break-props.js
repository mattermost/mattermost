(function() {
  var BreakProps, Declaration,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Declaration = require('../declaration');

  BreakProps = (function(superClass) {
    extend(BreakProps, superClass);

    function BreakProps() {
      return BreakProps.__super__.constructor.apply(this, arguments);
    }

    BreakProps.names = ['break-inside', 'page-break-inside', 'column-break-inside', 'break-before', 'page-break-before', 'column-break-before', 'break-after', 'page-break-after', 'column-break-after'];

    BreakProps.prototype.prefixed = function(prop, prefix) {
      if (prefix === '-webkit-') {
        return '-webkit-column-' + prop;
      } else if (prefix === '-moz-') {
        return 'page-' + prop;
      } else {
        return BreakProps.__super__.prefixed.apply(this, arguments);
      }
    };

    BreakProps.prototype.normalize = function(prop) {
      if (prop.indexOf('inside') !== -1) {
        return 'break-inside';
      } else if (prop.indexOf('before') !== -1) {
        return 'break-before';
      } else if (prop.indexOf('after') !== -1) {
        return 'break-after';
      }
    };

    BreakProps.prototype.set = function(decl, prefix) {
      var v;
      v = decl.value;
      if (decl.prop === 'break-inside' && v === 'avoid-column' || v === 'avoid-page') {
        decl.value = 'avoid';
      }
      return BreakProps.__super__.set.apply(this, arguments);
    };

    BreakProps.prototype.insert = function(decl, prefix, prefixes) {
      if (decl.prop !== 'break-inside') {
        return BreakProps.__super__.insert.apply(this, arguments);
      } else if (decl.value === 'avoid-region') {

      } else if (decl.value === 'avoid-page' && prefix === '-webkit-') {

      } else {
        return BreakProps.__super__.insert.apply(this, arguments);
      }
    };

    return BreakProps;

  })(Declaration);

  module.exports = BreakProps;

}).call(this);
