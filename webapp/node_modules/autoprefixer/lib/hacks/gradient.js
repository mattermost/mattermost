(function() {
  var Gradient, OldValue, Value, isDirection, list, parser, range, utils,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  OldValue = require('../old-value');

  Value = require('../value');

  utils = require('../utils');

  parser = require('postcss-value-parser');

  range = require('normalize-range');

  list = require('postcss/lib/list');

  isDirection = /top|left|right|bottom/gi;

  Gradient = (function(superClass) {
    extend(Gradient, superClass);

    function Gradient() {
      return Gradient.__super__.constructor.apply(this, arguments);
    }

    Gradient.names = ['linear-gradient', 'repeating-linear-gradient', 'radial-gradient', 'repeating-radial-gradient'];

    Gradient.prototype.replace = function(string, prefix) {
      var ast, changes, j, len, node, ref;
      ast = parser(string);
      ref = ast.nodes;
      for (j = 0, len = ref.length; j < len; j++) {
        node = ref[j];
        if (node.type === 'function' && node.value === this.name) {
          node.nodes = this.newDirection(node.nodes);
          node.nodes = this.normalize(node.nodes);
          if (prefix === '-webkit- old') {
            changes = this.oldWebkit(node);
            if (!changes) {
              return;
            }
          } else {
            node.nodes = this.convertDirection(node.nodes);
            node.value = prefix + node.value;
          }
        }
      }
      return ast.toString();
    };

    Gradient.prototype.directions = {
      top: 'bottom',
      left: 'right',
      bottom: 'top',
      right: 'left'
    };

    Gradient.prototype.oldDirections = {
      'top': 'left bottom, left top',
      'left': 'right top, left top',
      'bottom': 'left top, left bottom',
      'right': 'left top, right top',
      'top right': 'left bottom, right top',
      'top left': 'right bottom, left top',
      'right top': 'left bottom, right top',
      'right bottom': 'left top, right bottom',
      'bottom right': 'left top, right bottom',
      'bottom left': 'right top, left bottom',
      'left top': 'right bottom, left top',
      'left bottom': 'right top, left bottom'
    };

    Gradient.prototype.replaceFirst = function() {
      var params, prefix, words;
      params = arguments[0], words = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      prefix = words.map(function(i) {
        if (i === ' ') {
          return {
            type: 'space',
            value: i
          };
        } else {
          return {
            type: 'word',
            value: i
          };
        }
      });
      return prefix.concat(params.slice(1));
    };

    Gradient.prototype.normalizeUnit = function(str, full) {
      var deg, num;
      num = parseFloat(str);
      deg = (num / full) * 360;
      return deg + "deg";
    };

    Gradient.prototype.normalize = function(nodes) {
      var num;
      if (!nodes[0]) {
        return nodes;
      }
      if (/-?\d+(.\d+)?grad/.test(nodes[0].value)) {
        nodes[0].value = this.normalizeUnit(nodes[0].value, 400);
      } else if (/-?\d+(.\d+)?rad/.test(nodes[0].value)) {
        nodes[0].value = this.normalizeUnit(nodes[0].value, 2 * Math.PI);
      } else if (/-?\d+(.\d+)?turn/.test(nodes[0].value)) {
        nodes[0].value = this.normalizeUnit(nodes[0].value, 1);
      } else if (nodes[0].value.indexOf('deg') !== -1) {
        num = parseFloat(nodes[0].value);
        num = range.wrap(0, 360, num);
        nodes[0].value = num + "deg";
      }
      if (nodes[0].value === '0deg') {
        nodes = this.replaceFirst(nodes, 'to', ' ', 'top');
      } else if (nodes[0].value === '90deg') {
        nodes = this.replaceFirst(nodes, 'to', ' ', 'right');
      } else if (nodes[0].value === '180deg') {
        nodes = this.replaceFirst(nodes, 'to', ' ', 'bottom');
      } else if (nodes[0].value === '270deg') {
        nodes = this.replaceFirst(nodes, 'to', ' ', 'left');
      }
      return nodes;
    };

    Gradient.prototype.newDirection = function(params) {
      var i, j, ref;
      if (params[0].value === 'to') {
        return params;
      }
      if (!isDirection.test(params[0].value)) {
        return params;
      }
      params.unshift({
        type: 'word',
        value: 'to'
      }, {
        type: 'space',
        value: ' '
      });
      for (i = j = 2, ref = params.length; 2 <= ref ? j < ref : j > ref; i = 2 <= ref ? ++j : --j) {
        if (params[i].type === 'div') {
          break;
        }
        if (params[i].type === 'word') {
          params[i].value = this.revertDirection(params[i].value);
        }
      }
      return params;
    };

    Gradient.prototype.convertDirection = function(params) {
      if (params.length > 0) {
        if (params[0].value === 'to') {
          this.fixDirection(params);
        } else if (params[0].value.indexOf('deg') !== -1) {
          this.fixAngle(params);
        } else if (params[2].value === 'at') {
          this.fixRadial(params);
        }
      }
      return params;
    };

    Gradient.prototype.fixDirection = function(params) {
      var i, j, ref, results;
      params.splice(0, 2);
      results = [];
      for (i = j = 0, ref = params.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
        if (params[i].type === 'div') {
          break;
        }
        if (params[i].type === 'word') {
          results.push(params[i].value = this.revertDirection(params[i].value));
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Gradient.prototype.fixAngle = function(params) {
      var first;
      first = params[0].value;
      first = parseFloat(first);
      first = Math.abs(450 - first) % 360;
      first = this.roundFloat(first, 3);
      return params[0].value = first + "deg";
    };

    Gradient.prototype.fixRadial = function(params) {
      var first, i, j, ref, second;
      first = params[0];
      second = [];
      for (i = j = 4, ref = params.length; 4 <= ref ? j < ref : j > ref; i = 4 <= ref ? ++j : --j) {
        if (params[i].type === 'div') {
          break;
        } else {
          second.push(params[i]);
        }
      }
      return params.splice.apply(params, [0, i].concat(slice.call(second), [params[i + 2]], [first]));
    };

    Gradient.prototype.revertDirection = function(word) {
      return this.directions[word.toLowerCase()] || word;
    };

    Gradient.prototype.roundFloat = function(float, digits) {
      return parseFloat(float.toFixed(digits));
    };

    Gradient.prototype.oldWebkit = function(node) {
      var i, j, k, len, len1, nodes, param, params, string;
      nodes = node.nodes;
      string = parser.stringify(node.nodes);
      if (this.name !== 'linear-gradient') {
        return false;
      }
      if (nodes[0] && nodes[0].value.indexOf('deg') !== -1) {
        return false;
      }
      if (string.indexOf('px') !== -1) {
        return false;
      }
      if (string.indexOf('-corner') !== -1) {
        return false;
      }
      if (string.indexOf('-side') !== -1) {
        return false;
      }
      params = [[]];
      for (j = 0, len = nodes.length; j < len; j++) {
        i = nodes[j];
        params[params.length - 1].push(i);
        if (i.type === 'div' && i.value === ',') {
          params.push([]);
        }
      }
      this.oldDirection(params);
      this.colorStops(params);
      node.nodes = [];
      for (k = 0, len1 = params.length; k < len1; k++) {
        param = params[k];
        node.nodes = node.nodes.concat(param);
      }
      node.nodes.unshift({
        type: 'word',
        value: 'linear'
      }, this.cloneDiv(node.nodes));
      node.value = '-webkit-gradient';
      return true;
    };

    Gradient.prototype.oldDirection = function(params) {
      var div, j, len, node, old, ref, words;
      div = this.cloneDiv(params[0]);
      if (params[0][0].value !== 'to') {
        return params.unshift([
          {
            type: 'word',
            value: this.oldDirections.bottom
          }, div
        ]);
      } else {
        words = [];
        ref = params[0].slice(2);
        for (j = 0, len = ref.length; j < len; j++) {
          node = ref[j];
          if (node.type === 'word') {
            words.push(node.value.toLowerCase());
          }
        }
        words = words.join(' ');
        old = this.oldDirections[words] || words;
        return params[0] = [
          {
            type: 'word',
            value: old
          }, div
        ];
      }
    };

    Gradient.prototype.cloneDiv = function(params) {
      var i, j, len;
      for (j = 0, len = params.length; j < len; j++) {
        i = params[j];
        if (i.type === 'div' && i.value === ',') {
          return i;
        }
      }
      return {
        type: 'div',
        value: ',',
        after: ' '
      };
    };

    Gradient.prototype.colorStops = function(params) {
      var color, div, i, j, len, param, pos, results, stop;
      results = [];
      for (i = j = 0, len = params.length; j < len; i = ++j) {
        param = params[i];
        if (i === 0) {
          continue;
        }
        color = parser.stringify(param[0]);
        if (param[1] && param[1].type === 'word') {
          pos = param[1].value;
        } else if (param[2] && param[2].type === 'word') {
          pos = param[2].value;
        }
        stop = i === 1 && (!pos || pos === '0%') ? "from(" + color + ")" : i === params.length - 1 && (!pos || pos === '100%') ? "to(" + color + ")" : pos ? "color-stop(" + pos + ", " + color + ")" : "color-stop(" + color + ")";
        div = param[param.length - 1];
        params[i] = [
          {
            type: 'word',
            value: stop
          }
        ];
        if (div.type === 'div' && div.value === ',') {
          results.push(params[i].push(div));
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Gradient.prototype.old = function(prefix) {
      var regexp, string, type;
      if (prefix === '-webkit-') {
        type = this.name === 'linear-gradient' ? 'linear' : 'radial';
        string = '-gradient';
        regexp = utils.regexp("-webkit-(" + type + "-gradient|gradient\\(\\s*" + type + ")", false);
        return new OldValue(this.name, prefix + this.name, string, regexp);
      } else {
        return Gradient.__super__.old.apply(this, arguments);
      }
    };

    Gradient.prototype.add = function(decl, prefix) {
      var p;
      p = decl.prop;
      if (p.indexOf('mask') !== -1) {
        if (prefix === '-webkit-' || prefix === '-webkit- old') {
          return Gradient.__super__.add.apply(this, arguments);
        }
      } else if (p === 'list-style' || p === 'list-style-image' || p === 'content') {
        if (prefix === '-webkit-' || prefix === '-webkit- old') {
          return Gradient.__super__.add.apply(this, arguments);
        }
      } else {
        return Gradient.__super__.add.apply(this, arguments);
      }
    };

    return Gradient;

  })(Value);

  module.exports = Gradient;

}).call(this);
