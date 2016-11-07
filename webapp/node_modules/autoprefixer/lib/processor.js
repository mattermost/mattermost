(function() {
  var OLD_DIRECTION, Processor, Value, utils, vendor;

  vendor = require('postcss/lib/vendor');

  Value = require('./value');

  utils = require('./utils');

  OLD_DIRECTION = /(^|[^-])(linear|radial)-gradient\(\s*(top|left|right|bottom)/i;

  Processor = (function() {
    function Processor(prefixes) {
      this.prefixes = prefixes;
    }

    Processor.prototype.add = function(css, result) {
      var keyframes, resolution, supports, viewport;
      resolution = this.prefixes.add['@resolution'];
      keyframes = this.prefixes.add['@keyframes'];
      viewport = this.prefixes.add['@viewport'];
      supports = this.prefixes.add['@supports'];
      css.walkAtRules((function(_this) {
        return function(rule) {
          if (rule.name === 'keyframes') {
            if (!_this.disabled(rule)) {
              return keyframes != null ? keyframes.process(rule) : void 0;
            }
          } else if (rule.name === 'viewport') {
            if (!_this.disabled(rule)) {
              return viewport != null ? viewport.process(rule) : void 0;
            }
          } else if (rule.name === 'supports') {
            if (_this.prefixes.options.supports !== false && !_this.disabled(rule)) {
              return supports.process(rule);
            }
          } else if (rule.name === 'media' && rule.params.indexOf('-resolution') !== -1) {
            if (!_this.disabled(rule)) {
              return resolution != null ? resolution.process(rule) : void 0;
            }
          }
        };
      })(this));
      css.walkRules((function(_this) {
        return function(rule) {
          var j, len, ref, results, selector;
          if (_this.disabled(rule)) {
            return;
          }
          ref = _this.prefixes.add.selectors;
          results = [];
          for (j = 0, len = ref.length; j < len; j++) {
            selector = ref[j];
            results.push(selector.process(rule, result));
          }
          return results;
        };
      })(this));
      css.walkDecls((function(_this) {
        return function(decl) {
          var display, prefixer;
          if (_this.disabled(decl)) {
            return;
          }
          if (decl.prop === 'display' && decl.value === 'box') {
            result.warn('You should write display: flex by final spec ' + 'instead of display: box', {
              node: decl
            });
            return;
          }
          if (decl.value.indexOf('linear-gradient') !== -1) {
            if (OLD_DIRECTION.test(decl.value)) {
              result.warn('Gradient has outdated direction syntax. ' + 'New syntax is like `to left` instead of `right`.', {
                node: decl
              });
            }
          }
          if (decl.prop === 'text-emphasis-position') {
            if (decl.value === 'under' || decl.value === 'over') {
              result.warn('You should use 2 values for text-emphasis-position ' + 'For example, `under left` instead of just `under`.', {
                node: decl
              });
            }
          }
          if (decl.value.indexOf('fill-available') !== -1) {
            result.warn('Replace fill-available to fill, ' + 'because spec had been changed', {
              node: decl
            });
          }
          if (_this.prefixes.options.flexbox !== false) {
            if (decl.prop === 'grid-row-end' && decl.value.indexOf('span') === -1) {
              result.warn('IE supports only grid-row-end with span. ' + 'You should add grid: false option to Autoprefixer ' + 'and use some JS grid polyfill for full spec support', {
                node: decl
              });
            }
            if (decl.prop === 'grid-row') {
              if (decl.value.indexOf('/') !== -1 && decl.value.indexOf('span') === -1) {
                result.warn('IE supports only grid-row with / and span. ' + 'You should add grid: false option to Autoprefixer ' + 'and use some JS grid polyfill for full spec support', {
                  node: decl
                });
              }
            }
          }
          if (decl.prop === 'transition' || decl.prop === 'transition-property') {
            return _this.prefixes.transition.add(decl, result);
          } else if (decl.prop === 'align-self') {
            display = _this.displayType(decl);
            if (display !== 'grid' && _this.prefixes.options.flexbox !== false) {
              prefixer = _this.prefixes.add['align-self'];
              if (prefixer && prefixer.prefixes) {
                prefixer.process(decl);
              }
            }
            if (display !== 'flex' && _this.prefixes.options.grid !== false) {
              prefixer = _this.prefixes.add['grid-row-align'];
              if (prefixer && prefixer.prefixes) {
                return prefixer.process(decl);
              }
            }
          } else {
            prefixer = _this.prefixes.add[decl.prop];
            if (prefixer && prefixer.prefixes) {
              return prefixer.process(decl);
            }
          }
        };
      })(this));
      return css.walkDecls((function(_this) {
        return function(decl) {
          var j, len, ref, unprefixed, value;
          if (_this.disabled(decl)) {
            return;
          }
          unprefixed = _this.prefixes.unprefixed(decl.prop);
          ref = _this.prefixes.values('add', unprefixed);
          for (j = 0, len = ref.length; j < len; j++) {
            value = ref[j];
            value.process(decl, result);
          }
          return Value.save(_this.prefixes, decl);
        };
      })(this));
    };

    Processor.prototype.remove = function(css) {
      var checker, j, len, ref, resolution;
      resolution = this.prefixes.remove['@resolution'];
      css.walkAtRules((function(_this) {
        return function(rule, i) {
          if (_this.prefixes.remove['@' + rule.name]) {
            if (!_this.disabled(rule)) {
              return rule.parent.removeChild(i);
            }
          } else if (rule.name === 'media' && rule.params.indexOf('-resolution') !== -1) {
            return resolution != null ? resolution.clean(rule) : void 0;
          }
        };
      })(this));
      ref = this.prefixes.remove.selectors;
      for (j = 0, len = ref.length; j < len; j++) {
        checker = ref[j];
        css.walkRules((function(_this) {
          return function(rule, i) {
            if (checker.check(rule)) {
              if (!_this.disabled(rule)) {
                return rule.parent.removeChild(i);
              }
            }
          };
        })(this));
      }
      return css.walkDecls((function(_this) {
        return function(decl, i) {
          var k, len1, notHack, ref1, ref2, rule, unprefixed;
          if (_this.disabled(decl)) {
            return;
          }
          rule = decl.parent;
          unprefixed = _this.prefixes.unprefixed(decl.prop);
          if (decl.prop === 'transition' || decl.prop === 'transition-property') {
            _this.prefixes.transition.remove(decl);
          }
          if ((ref1 = _this.prefixes.remove[decl.prop]) != null ? ref1.remove : void 0) {
            notHack = _this.prefixes.group(decl).down(function(other) {
              return _this.prefixes.normalize(other.prop) === unprefixed;
            });
            if (notHack && !_this.withHackValue(decl)) {
              if (decl.raw('before').indexOf("\n") > -1) {
                _this.reduceSpaces(decl);
              }
              rule.removeChild(i);
              return;
            }
          }
          ref2 = _this.prefixes.values('remove', unprefixed);
          for (k = 0, len1 = ref2.length; k < len1; k++) {
            checker = ref2[k];
            if (checker.check(decl.value)) {
              unprefixed = checker.unprefixed;
              notHack = _this.prefixes.group(decl).down(function(other) {
                return other.value.indexOf(unprefixed) !== -1;
              });
              if (notHack) {
                rule.removeChild(i);
                return;
              } else if (checker.clean) {
                checker.clean(decl);
                return;
              }
            }
          }
        };
      })(this));
    };

    Processor.prototype.withHackValue = function(decl) {
      return decl.prop === '-webkit-background-clip' && decl.value === 'text';
    };

    Processor.prototype.disabled = function(node) {
      var other, status;
      if (this.prefixes.options.grid === false && node.type === 'decl') {
        if (node.prop === 'display' && node.value.indexOf('grid') !== -1) {
          return true;
        }
        if (node.prop.indexOf('grid') !== -1 || node.prop === 'justify-items') {
          return true;
        }
      }
      if (this.prefixes.options.flexbox === false && node.type === 'decl') {
        if (node.prop === 'display' && node.value.indexOf('flex') !== -1) {
          return true;
        }
        other = ['order', 'justify-content', 'align-items', 'align-content'];
        if (node.prop.indexOf('flex') !== -1 || other.indexOf(node.prop) !== -1) {
          return true;
        }
      }
      if (node._autoprefixerDisabled != null) {
        return node._autoprefixerDisabled;
      } else if (node.nodes) {
        status = void 0;
        node.each(function(i) {
          if (i.type !== 'comment') {
            return;
          }
          if (/(!\s*)?autoprefixer:\s*off/i.test(i.text)) {
            status = false;
            return false;
          } else if (/(!\s*)?autoprefixer:\s*on/i.test(i.text)) {
            status = true;
            return false;
          }
        });
        return node._autoprefixerDisabled = status != null ? !status : node.parent ? this.disabled(node.parent) : false;
      } else if (node.parent) {
        return node._autoprefixerDisabled = this.disabled(node.parent);
      } else {
        return false;
      }
    };

    Processor.prototype.reduceSpaces = function(decl) {
      var diff, parts, prevMin, stop;
      stop = false;
      this.prefixes.group(decl).up(function(other) {
        return stop = true;
      });
      if (stop) {
        return;
      }
      parts = decl.raw('before').split("\n");
      prevMin = parts[parts.length - 1].length;
      diff = false;
      return this.prefixes.group(decl).down(function(other) {
        var last;
        parts = other.raw('before').split("\n");
        last = parts.length - 1;
        if (parts[last].length > prevMin) {
          if (diff === false) {
            diff = parts[last].length - prevMin;
          }
          parts[last] = parts[last].slice(0, -diff);
          return other.raws.before = parts.join("\n");
        }
      });
    };

    Processor.prototype.displayType = function(decl) {
      var i, j, len, ref;
      ref = decl.parent.nodes;
      for (j = 0, len = ref.length; j < len; j++) {
        i = ref[j];
        if (i.prop === 'display') {
          if (i.value.indexOf('flex') !== -1) {
            return 'flex';
          } else if (i.value.indexOf('grid') !== -1) {
            return 'grid';
          }
        }
      }
      return false;
    };

    return Processor;

  })();

  module.exports = Processor;

}).call(this);
