(function() {
  var CrossFade, OldValue, Value, list, utils,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  OldValue = require('../old-value');

  Value = require('../value');

  utils = require('../utils');

  list = require('postcss/lib/list');

  CrossFade = (function(superClass) {
    extend(CrossFade, superClass);

    function CrossFade() {
      return CrossFade.__super__.constructor.apply(this, arguments);
    }

    CrossFade.names = ['cross-fade'];

    CrossFade.prototype.replace = function(string, prefix) {
      return list.space(string).map((function(_this) {
        return function(value) {
          var after, args, close, match;
          if (value.slice(0, +_this.name.length + 1 || 9e9) !== _this.name + '(') {
            return value;
          }
          close = value.lastIndexOf(')');
          after = value.slice(close + 1);
          args = value.slice(_this.name.length + 1, +(close - 1) + 1 || 9e9);
          if (prefix === '-webkit-') {
            match = args.match(/\d*.?\d+%?/);
            if (match) {
              args = args.slice(match[0].length).trim();
              args += ', ' + match[0];
            } else {
              args += ', 0.5';
            }
          }
          return prefix + _this.name + '(' + args + ')' + after;
        };
      })(this)).join(' ');
    };

    return CrossFade;

  })(Value);

  module.exports = CrossFade;

}).call(this);
