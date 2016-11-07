(function() {
  var Declaration, GridTemplate, parser,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  parser = require('postcss-value-parser');

  Declaration = require('../declaration');

  GridTemplate = (function(superClass) {
    extend(GridTemplate, superClass);

    function GridTemplate() {
      return GridTemplate.__super__.constructor.apply(this, arguments);
    }

    GridTemplate.names = ['grid-template-rows', 'grid-template-columns', 'grid-rows', 'grid-columns'];

    GridTemplate.prototype.prefixed = function(prop, prefix) {
      if (prefix === '-ms-') {
        return prefix + prop.replace('template-', '');
      } else {
        return GridTemplate.__super__.prefixed.call(this, prop, prefix);
      }
    };

    GridTemplate.prototype.normalize = function(prop) {
      return prop.replace(/^grid-(rows|columns)/, 'grid-template-$1');
    };

    GridTemplate.prototype.walkRepeat = function(node) {
      var count, first, fixed, i, j, len, ref;
      fixed = [];
      ref = node.nodes;
      for (j = 0, len = ref.length; j < len; j++) {
        i = ref[j];
        if (i.nodes) {
          this.walkRepeat(i);
        }
        fixed.push(i);
        if (i.type === 'function' && i.value === 'repeat') {
          first = i.nodes.shift();
          if (first) {
            count = first.value;
            i.nodes.shift();
            i.value = '';
            fixed.push({
              type: 'word',
              value: "[" + count + "]"
            });
          }
        }
      }
      return node.nodes = fixed;
    };

    GridTemplate.prototype.changeRepeat = function(value) {
      var ast;
      ast = parser(value);
      this.walkRepeat(ast);
      return ast.toString();
    };

    GridTemplate.prototype.set = function(decl, prefix) {
      if (prefix === '-ms-' && decl.value.indexOf('repeat(') !== -1) {
        decl.value = this.changeRepeat(decl.value);
      }
      return GridTemplate.__super__.set.call(this, decl, prefix);
    };

    return GridTemplate;

  })(Declaration);

  module.exports = GridTemplate;

}).call(this);
