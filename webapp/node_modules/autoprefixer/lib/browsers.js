(function() {
  var Browsers, browserslist, utils;

  browserslist = require('browserslist');

  utils = require('./utils');

  Browsers = (function() {
    Browsers.prefixes = function() {
      var data, i, name;
      if (this.prefixesCache) {
        return this.prefixesCache;
      }
      data = require('caniuse-db/data.json').agents;
      return this.prefixesCache = utils.uniq((function() {
        var results;
        results = [];
        for (name in data) {
          i = data[name];
          results.push("-" + i.prefix + "-");
        }
        return results;
      })()).sort(function(a, b) {
        return b.length - a.length;
      });
    };

    Browsers.withPrefix = function(value) {
      if (!this.prefixesRegexp) {
        this.prefixesRegexp = RegExp("" + (this.prefixes().join('|')));
      }
      return this.prefixesRegexp.test(value);
    };

    function Browsers(data1, requirements, options, stats) {
      this.data = data1;
      this.options = options;
      this.stats = stats;
      this.selected = this.parse(requirements);
    }

    Browsers.prototype.parse = function(requirements) {
      var ref;
      return browserslist(requirements, {
        path: (ref = this.options) != null ? ref.from : void 0,
        stats: this.stats
      });
    };

    Browsers.prototype.browsers = function(criteria) {
      var browser, data, ref, selected, versions;
      selected = [];
      ref = this.data;
      for (browser in ref) {
        data = ref[browser];
        versions = criteria(data).map(function(version) {
          return browser + " " + version;
        });
        selected = selected.concat(versions);
      }
      return selected;
    };

    Browsers.prototype.prefix = function(browser) {
      var data, name, prefix, ref, version;
      ref = browser.split(' '), name = ref[0], version = ref[1];
      data = this.data[name];
      if (data.prefix_exceptions) {
        prefix = data.prefix_exceptions[version];
      }
      prefix || (prefix = data.prefix);
      return '-' + prefix + '-';
    };

    Browsers.prototype.isSelected = function(browser) {
      return this.selected.indexOf(browser) !== -1;
    };

    return Browsers;

  })();

  module.exports = Browsers;

}).call(this);
