(function() {
  var Browsers, OldSelector, Prefixer, Selector, utils,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  OldSelector = require('./old-selector');

  Prefixer = require('./prefixer');

  Browsers = require('./browsers');

  utils = require('./utils');

  Selector = (function(superClass) {
    extend(Selector, superClass);

    function Selector(name1, prefixes, all) {
      this.name = name1;
      this.prefixes = prefixes;
      this.all = all;
      this.regexpCache = {};
    }

    Selector.prototype.check = function(rule) {
      if (rule.selector.indexOf(this.name) !== -1) {
        return !!rule.selector.match(this.regexp());
      } else {
        return false;
      }
    };

    Selector.prototype.prefixed = function(prefix) {
      return this.name.replace(/^([^\w]*)/, '$1' + prefix);
    };

    Selector.prototype.regexp = function(prefix) {
      var name;
      if (this.regexpCache[prefix]) {
        return this.regexpCache[prefix];
      }
      name = prefix ? this.prefixed(prefix) : this.name;
      return this.regexpCache[prefix] = RegExp("(^|[^:\"'=])" + (utils.escapeRegexp(name)), "gi");
    };

    Selector.prototype.possible = function() {
      return Browsers.prefixes();
    };

    Selector.prototype.prefixeds = function(rule) {
      var i, len, prefix, prefixeds, ref;
      if (rule._autoprefixerPrefixeds) {
        return rule._autoprefixerPrefixeds;
      }
      prefixeds = {};
      ref = this.possible();
      for (i = 0, len = ref.length; i < len; i++) {
        prefix = ref[i];
        prefixeds[prefix] = this.replace(rule.selector, prefix);
      }
      return rule._autoprefixerPrefixeds = prefixeds;
    };

    Selector.prototype.already = function(rule, prefixeds, prefix) {
      var before, index, key, prefixed, some;
      index = rule.parent.index(rule) - 1;
      while (index >= 0) {
        before = rule.parent.nodes[index];
        if (before.type !== 'rule') {
          return false;
        }
        some = false;
        for (key in prefixeds) {
          prefixed = prefixeds[key];
          if (before.selector === prefixed) {
            if (prefix === key) {
              return true;
            } else {
              some = true;
              break;
            }
          }
        }
        if (!some) {
          return false;
        }
        index -= 1;
      }
      return false;
    };

    Selector.prototype.replace = function(selector, prefix) {
      return selector.replace(this.regexp(), '$1' + this.prefixed(prefix));
    };

    Selector.prototype.add = function(rule, prefix) {
      var cloned, prefixeds;
      prefixeds = this.prefixeds(rule);
      if (this.already(rule, prefixeds, prefix)) {
        return;
      }
      cloned = this.clone(rule, {
        selector: prefixeds[prefix]
      });
      return rule.parent.insertBefore(rule, cloned);
    };

    Selector.prototype.old = function(prefix) {
      return new OldSelector(this, prefix);
    };

    return Selector;

  })(Prefixer);

  module.exports = Selector;

}).call(this);
