(function() {
  var Browsers, Supports, Value, brackets, browser, data, postcss, ref, support, supported, utils, version, versions;

  Browsers = require('./browsers');

  brackets = require('./brackets');

  Value = require('./value');

  utils = require('./utils');

  postcss = require('postcss');

  supported = [];

  data = require('caniuse-db/features-json/css-featurequeries.json');

  ref = data.stats;
  for (browser in ref) {
    versions = ref[browser];
    for (version in versions) {
      support = versions[version];
      if (/y/.test(support)) {
        supported.push(browser + ' ' + version);
      }
    }
  }

  Supports = (function() {
    function Supports(Prefixes, all1) {
      this.Prefixes = Prefixes;
      this.all = all1;
    }

    Supports.prototype.prefixer = function() {
      var browsers, filtered;
      if (this.prefixerCache) {
        return this.prefixerCache;
      }
      filtered = this.all.browsers.selected.filter((function(_this) {
        return function(i) {
          return supported.indexOf(i) !== -1;
        };
      })(this));
      browsers = new Browsers(this.all.browsers.data, filtered, this.all.options);
      return this.prefixerCache = new this.Prefixes(this.all.data, browsers, this.all.options);
    };

    Supports.prototype.parse = function(str) {
      var prop, ref1, value;
      ref1 = str.split(':'), prop = ref1[0], value = ref1[1];
      value || (value = '');
      return [prop.trim(), value.trim()];
    };

    Supports.prototype.virtual = function(str) {
      var prop, ref1, rule, value;
      ref1 = this.parse(str), prop = ref1[0], value = ref1[1];
      rule = postcss.parse('a{}').first;
      rule.append({
        prop: prop,
        value: value,
        raws: {
          before: ''
        }
      });
      return rule;
    };

    Supports.prototype.prefixed = function(str) {
      var decl, j, k, len, len1, prefixer, prop, ref1, ref2, rule, value;
      rule = this.virtual(str);
      prop = rule.first.prop;
      prefixer = this.prefixer().add[prop];
      if (prefixer != null) {
        if (typeof prefixer.process === "function") {
          prefixer.process(rule.first);
        }
      }
      ref1 = rule.nodes;
      for (j = 0, len = ref1.length; j < len; j++) {
        decl = ref1[j];
        ref2 = this.prefixer().values('add', prop);
        for (k = 0, len1 = ref2.length; k < len1; k++) {
          value = ref2[k];
          value.process(decl);
        }
        Value.save(this.all, decl);
      }
      return rule.nodes;
    };

    Supports.prototype.isNot = function(node) {
      return typeof node === 'string' && /not\s*/i.test(node);
    };

    Supports.prototype.isOr = function(node) {
      return typeof node === 'string' && /\s*or\s*/i.test(node);
    };

    Supports.prototype.isProp = function(node) {
      return typeof node === 'object' && node.length === 1 && typeof node[0] === 'string';
    };

    Supports.prototype.isHack = function(all, unprefixed) {
      var check;
      check = new RegExp('(\\(|\\s)' + utils.escapeRegexp(unprefixed) + ':');
      return !check.test(all);
    };

    Supports.prototype.toRemove = function(str, all) {
      var checker, j, len, prop, ref1, ref2, ref3, unprefixed, value;
      ref1 = this.parse(str), prop = ref1[0], value = ref1[1];
      unprefixed = this.all.unprefixed(prop);
      if (((ref2 = this.all.cleaner().remove[prop]) != null ? ref2.remove : void 0) && !this.isHack(all, unprefixed)) {
        return true;
      }
      ref3 = this.all.cleaner().values('remove', unprefixed);
      for (j = 0, len = ref3.length; j < len; j++) {
        checker = ref3[j];
        if (checker.check(value)) {
          return true;
        }
      }
      return false;
    };

    Supports.prototype.remove = function(nodes, all) {
      var i;
      i = 0;
      while (i < nodes.length) {
        if (!this.isNot(nodes[i - 1]) && this.isProp(nodes[i]) && this.isOr(nodes[i + 1])) {
          if (this.toRemove(nodes[i][0], all)) {
            nodes.splice(i, 2);
          } else {
            i += 2;
          }
        } else {
          if (typeof nodes[i] === 'object') {
            nodes[i] = this.remove(nodes[i], all);
          }
          i += 1;
        }
      }
      return nodes;
    };

    Supports.prototype.cleanBrackets = function(nodes) {
      return nodes.map((function(_this) {
        return function(i) {
          if (typeof i === 'object') {
            if (i.length === 1 && typeof i[0] === 'object') {
              return _this.cleanBrackets(i[0]);
            } else {
              return _this.cleanBrackets(i);
            }
          } else {
            return i;
          }
        };
      })(this));
    };

    Supports.prototype.convert = function(progress) {
      var i, j, len, result;
      result = [''];
      for (j = 0, len = progress.length; j < len; j++) {
        i = progress[j];
        result.push([i.prop + ": " + i.value]);
        result.push(' or ');
      }
      result[result.length - 1] = '';
      return result;
    };

    Supports.prototype.normalize = function(nodes) {
      if (typeof nodes === 'object') {
        nodes = nodes.filter(function(i) {
          return i !== '';
        });
        if (typeof nodes[0] === 'string' && nodes[0].indexOf(':') !== -1) {
          return [brackets.stringify(nodes)];
        } else {
          return nodes.map((function(_this) {
            return function(i) {
              return _this.normalize(i);
            };
          })(this));
        }
      } else {
        return nodes;
      }
    };

    Supports.prototype.add = function(nodes, all) {
      return nodes.map((function(_this) {
        return function(i) {
          var prefixed;
          if (_this.isProp(i)) {
            prefixed = _this.prefixed(i[0]);
            if (prefixed.length > 1) {
              return _this.convert(prefixed);
            } else {
              return i;
            }
          } else if (typeof i === 'object') {
            return _this.add(i, all);
          } else {
            return i;
          }
        };
      })(this));
    };

    Supports.prototype.process = function(rule) {
      var ast;
      ast = brackets.parse(rule.params);
      ast = this.normalize(ast);
      ast = this.remove(ast, rule.params);
      ast = this.add(ast, rule.params);
      ast = this.cleanBrackets(ast);
      return rule.params = brackets.stringify(ast);
    };

    return Supports;

  })();

  module.exports = Supports;

}).call(this);
