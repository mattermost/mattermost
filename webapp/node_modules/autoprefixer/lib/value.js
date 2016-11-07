(function() {
  var OldValue, Prefixer, Value, utils, vendor,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Prefixer = require('./prefixer');

  OldValue = require('./old-value');

  utils = require('./utils');

  vendor = require('postcss/lib/vendor');

  Value = (function(superClass) {
    extend(Value, superClass);

    function Value() {
      return Value.__super__.constructor.apply(this, arguments);
    }

    Value.save = function(prefixes, decl) {
      var already, cloned, prefix, prefixed, prop, propPrefix, ref, results, rule, trimmed, value;
      prop = decl.prop;
      ref = decl._autoprefixerValues;
      results = [];
      for (prefix in ref) {
        value = ref[prefix];
        if (value === decl.value) {
          continue;
        }
        propPrefix = vendor.prefix(prop);
        if (propPrefix === prefix) {
          results.push(decl.value = value);
        } else if (propPrefix === '-pie-') {
          continue;
        } else {
          prefixed = prefixes.prefixed(prop, prefix);
          rule = decl.parent;
          if (rule.every(function(i) {
            return i.prop !== prefixed;
          })) {
            trimmed = value.replace(/\s+/, ' ');
            already = rule.some(function(i) {
              return i.prop === decl.prop && i.value.replace(/\s+/, ' ') === trimmed;
            });
            if (!already) {
              cloned = this.clone(decl, {
                value: value
              });
              results.push(decl.parent.insertBefore(decl, cloned));
            } else {
              results.push(void 0);
            }
          } else {
            results.push(void 0);
          }
        }
      }
      return results;
    };

    Value.prototype.check = function(decl) {
      var value;
      value = decl.value;
      if (value.indexOf(this.name) !== -1) {
        return !!value.match(this.regexp());
      } else {
        return false;
      }
    };

    Value.prototype.regexp = function() {
      return this.regexpCache || (this.regexpCache = utils.regexp(this.name));
    };

    Value.prototype.replace = function(string, prefix) {
      return string.replace(this.regexp(), '$1' + prefix + '$2');
    };

    Value.prototype.value = function(decl) {
      if (decl.raws.value && decl.raws.value.value === decl.value) {
        return decl.raws.value.raw;
      } else {
        return decl.value;
      }
    };

    Value.prototype.add = function(decl, prefix) {
      var value;
      decl._autoprefixerValues || (decl._autoprefixerValues = {});
      value = decl._autoprefixerValues[prefix] || this.value(decl);
      value = this.replace(value, prefix);
      if (value) {
        return decl._autoprefixerValues[prefix] = value;
      }
    };

    Value.prototype.old = function(prefix) {
      return new OldValue(this.name, prefix + this.name);
    };

    return Value;

  })(Prefixer);

  module.exports = Value;

}).call(this);
