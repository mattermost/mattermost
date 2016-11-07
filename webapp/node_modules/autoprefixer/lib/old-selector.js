(function() {
  var OldSelector;

  OldSelector = (function() {
    function OldSelector(selector, prefix1) {
      var i, len, prefix, ref;
      this.prefix = prefix1;
      this.prefixed = selector.prefixed(this.prefix);
      this.regexp = selector.regexp(this.prefix);
      this.prefixeds = [];
      ref = selector.possible();
      for (i = 0, len = ref.length; i < len; i++) {
        prefix = ref[i];
        this.prefixeds.push([selector.prefixed(prefix), selector.regexp(prefix)]);
      }
      this.unprefixed = selector.name;
      this.nameRegexp = selector.regexp();
    }

    OldSelector.prototype.isHack = function(rule) {
      var before, i, index, len, ref, ref1, regexp, rules, some, string;
      index = rule.parent.index(rule) + 1;
      rules = rule.parent.nodes;
      while (index < rules.length) {
        before = rules[index].selector;
        if (!before) {
          return true;
        }
        if (before.indexOf(this.unprefixed) !== -1 && before.match(this.nameRegexp)) {
          return false;
        }
        some = false;
        ref = this.prefixeds;
        for (i = 0, len = ref.length; i < len; i++) {
          ref1 = ref[i], string = ref1[0], regexp = ref1[1];
          if (before.indexOf(string) !== -1 && before.match(regexp)) {
            some = true;
            break;
          }
        }
        if (!some) {
          return true;
        }
        index += 1;
      }
      return true;
    };

    OldSelector.prototype.check = function(rule) {
      if (rule.selector.indexOf(this.prefixed) === -1) {
        return false;
      }
      if (!rule.selector.match(this.regexp)) {
        return false;
      }
      if (this.isHack(rule)) {
        return false;
      }
      return true;
    };

    return OldSelector;

  })();

  module.exports = OldSelector;

}).call(this);
