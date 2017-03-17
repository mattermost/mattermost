(function() {
  var Transition, list, parser, vendor;

  parser = require('postcss-value-parser');

  vendor = require('postcss/lib/vendor');

  list = require('postcss/lib/list');

  Transition = (function() {
    function Transition(prefixes) {
      this.prefixes = prefixes;
    }

    Transition.prototype.props = ['transition', 'transition-property'];

    Transition.prototype.add = function(decl, result) {
      var added, declPrefixes, j, k, l, len, len1, len2, names, operaClean, param, params, prefix, prefixValue, prefixed, prefixer, prop, ref, ref1, value, webkitClean;
      declPrefixes = ((ref = this.prefixes.add[decl.prop]) != null ? ref.prefixes : void 0) || [];
      params = this.parse(decl.value);
      names = params.map((function(_this) {
        return function(i) {
          return _this.findProp(i);
        };
      })(this));
      added = [];
      if (names.some(function(i) {
        return i[0] === '-';
      })) {
        return;
      }
      for (j = 0, len = params.length; j < len; j++) {
        param = params[j];
        prop = this.findProp(param);
        if (prop[0] === '-') {
          continue;
        }
        prefixer = this.prefixes.add[prop];
        if (!(prefixer != null ? prefixer.prefixes : void 0)) {
          continue;
        }
        ref1 = prefixer.prefixes;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          prefix = ref1[k];
          prefixed = this.prefixes.prefixed(prop, prefix);
          if (prefixed !== '-ms-transform' && names.indexOf(prefixed) === -1) {
            if (!this.disabled(prop, prefix)) {
              added.push(this.clone(prop, prefixed, param));
            }
          }
        }
      }
      params = params.concat(added);
      value = this.stringify(params);
      webkitClean = this.stringify(this.cleanFromUnprefixed(params, '-webkit-'));
      if (declPrefixes.indexOf('-webkit-') !== -1) {
        this.cloneBefore(decl, '-webkit-' + decl.prop, webkitClean);
      }
      this.cloneBefore(decl, decl.prop, webkitClean);
      if (declPrefixes.indexOf('-o-') !== -1) {
        operaClean = this.stringify(this.cleanFromUnprefixed(params, '-o-'));
        this.cloneBefore(decl, '-o-' + decl.prop, operaClean);
      }
      for (l = 0, len2 = declPrefixes.length; l < len2; l++) {
        prefix = declPrefixes[l];
        if (prefix !== '-webkit-' && prefix !== '-o-') {
          prefixValue = this.stringify(this.cleanOtherPrefixes(params, prefix));
          this.cloneBefore(decl, prefix + decl.prop, prefixValue);
        }
      }
      if (value !== decl.value && !this.already(decl, decl.prop, value)) {
        this.checkForWarning(result, decl);
        decl.cloneBefore();
        return decl.value = value;
      }
    };

    Transition.prototype.findProp = function(param) {
      var i, j, len, prop, token;
      prop = param[0].value;
      if (/^\d/.test(prop)) {
        for (i = j = 0, len = param.length; j < len; i = ++j) {
          token = param[i];
          if (i !== 0 && token.type === 'word') {
            return token.value;
          }
        }
      }
      return prop;
    };

    Transition.prototype.already = function(decl, prop, value) {
      return decl.parent.some(function(i) {
        return i.prop === prop && i.value === value;
      });
    };

    Transition.prototype.cloneBefore = function(decl, prop, value) {
      if (!this.already(decl, prop, value)) {
        return decl.cloneBefore({
          prop: prop,
          value: value
        });
      }
    };

    Transition.prototype.checkForWarning = function(result, decl) {
      if (decl.prop === 'transition-property') {
        return decl.parent.each(function(i) {
          if (i.type !== 'decl') {
            return;
          }
          if (i.prop.indexOf('transition-') !== 0) {
            return;
          }
          if (i.prop === 'transition-property') {
            return;
          }
          if (list.comma(i.value).length > 1) {
            decl.warn(result, 'Replace transition-property to transition, ' + 'because Autoprefixer could not support ' + 'any cases of transition-property ' + 'and other transition-*');
          }
          return false;
        });
      }
    };

    Transition.prototype.remove = function(decl) {
      var double, params, smaller, value;
      params = this.parse(decl.value);
      params = params.filter((function(_this) {
        return function(i) {
          var ref;
          return !((ref = _this.prefixes.remove[_this.findProp(i)]) != null ? ref.remove : void 0);
        };
      })(this));
      value = this.stringify(params);
      if (decl.value === value) {
        return;
      }
      if (params.length === 0) {
        decl.remove();
        return;
      }
      double = decl.parent.some(function(i) {
        return i.prop === decl.prop && i.value === value;
      });
      smaller = decl.parent.some(function(i) {
        return i !== decl && i.prop === decl.prop && i.value.length > value.length;
      });
      if (double || smaller) {
        return decl.remove();
      } else {
        return decl.value = value;
      }
    };

    Transition.prototype.parse = function(value) {
      var ast, j, len, node, param, ref, result;
      ast = parser(value);
      result = [];
      param = [];
      ref = ast.nodes;
      for (j = 0, len = ref.length; j < len; j++) {
        node = ref[j];
        param.push(node);
        if (node.type === 'div' && node.value === ',') {
          result.push(param);
          param = [];
        }
      }
      result.push(param);
      return result.filter(function(i) {
        return i.length > 0;
      });
    };

    Transition.prototype.stringify = function(params) {
      var j, len, nodes, param;
      if (params.length === 0) {
        return '';
      }
      nodes = [];
      for (j = 0, len = params.length; j < len; j++) {
        param = params[j];
        if (param[param.length - 1].type !== 'div') {
          param.push(this.div(params));
        }
        nodes = nodes.concat(param);
      }
      if (nodes[0].type === 'div') {
        nodes = nodes.slice(1);
      }
      if (nodes[nodes.length - 1].type === 'div') {
        nodes = nodes.slice(0, -1);
      }
      return parser.stringify({
        nodes: nodes
      });
    };

    Transition.prototype.clone = function(origin, name, param) {
      var changed, i, j, len, result;
      result = [];
      changed = false;
      for (j = 0, len = param.length; j < len; j++) {
        i = param[j];
        if (!changed && i.type === 'word' && i.value === origin) {
          result.push({
            type: 'word',
            value: name
          });
          changed = true;
        } else {
          result.push(i);
        }
      }
      return result;
    };

    Transition.prototype.div = function(params) {
      var j, k, len, len1, node, param;
      for (j = 0, len = params.length; j < len; j++) {
        param = params[j];
        for (k = 0, len1 = param.length; k < len1; k++) {
          node = param[k];
          if (node.type === 'div' && node.value === ',') {
            return node;
          }
        }
      }
      return {
        type: 'div',
        value: ',',
        after: ' '
      };
    };

    Transition.prototype.cleanOtherPrefixes = function(params, prefix) {
      return params.filter((function(_this) {
        return function(param) {
          var current;
          current = vendor.prefix(_this.findProp(param));
          return current === '' || current === prefix;
        };
      })(this));
    };

    Transition.prototype.cleanFromUnprefixed = function(params, prefix) {
      var j, len, p, param, prop, remove, result;
      result = [];
      remove = params.map((function(_this) {
        return function(i) {
          return _this.findProp(i);
        };
      })(this)).filter(function(i) {
        return i.slice(0, prefix.length) === prefix;
      }).map((function(_this) {
        return function(i) {
          return _this.prefixes.unprefixed(i);
        };
      })(this));
      for (j = 0, len = params.length; j < len; j++) {
        param = params[j];
        prop = this.findProp(param);
        p = vendor.prefix(prop);
        if (remove.indexOf(prop) === -1 && (p === prefix || p === '')) {
          result.push(param);
        }
      }
      return result;
    };

    Transition.prototype.disabled = function(prop, prefix) {
      var other;
      other = ['order', 'justify-content', 'align-self', 'align-content'];
      if (prop.indexOf('flex') !== -1 || other.indexOf(prop) !== -1) {
        if (this.prefixes.options.flexbox === false) {
          return true;
        } else if (this.prefixes.options.flexbox === 'no-2009') {
          return prefix.indexOf('2009') !== -1;
        }
      }
    };

    return Transition;

  })();

  module.exports = Transition;

}).call(this);
