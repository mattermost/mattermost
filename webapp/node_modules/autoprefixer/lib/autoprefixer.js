(function() {
  var Browsers, Prefixes, browserslist, cache, isPlainObject, postcss, timeCapsule,
    slice = [].slice;

  browserslist = require('browserslist');

  postcss = require('postcss');

  Browsers = require('./browsers');

  Prefixes = require('./prefixes');

  isPlainObject = function(obj) {
    return Object.prototype.toString.apply(obj) === '[object Object]';
  };

  cache = {};

  timeCapsule = function(result, prefixes) {
    if (prefixes.browsers.selected.length === 0) {
      return;
    }
    if (prefixes.add.selectors.length > 0) {
      return;
    }
    if (Object.keys(prefixes.add).length > 2) {
      return;
    }
    return result.warn('Greetings, space traveller. ' + 'We are in the golden age of prefix-less CSS, ' + 'where Autoprefixer is no longer needed for your stylesheet.');
  };

  module.exports = postcss.plugin('autoprefixer', function() {
    var loadPrefixes, options, plugin, reqs;
    reqs = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    if (reqs.length === 1 && isPlainObject(reqs[0])) {
      options = reqs[0];
      reqs = void 0;
    } else if (reqs.length === 0 || (reqs.length === 1 && (reqs[0] == null))) {
      reqs = void 0;
    } else if (reqs.length <= 2 && (reqs[0] instanceof Array || (reqs[0] == null))) {
      options = reqs[1];
      reqs = reqs[0];
    } else if (typeof reqs[reqs.length - 1] === 'object') {
      options = reqs.pop();
    }
    options || (options = {});
    if (options.browsers != null) {
      reqs = options.browsers;
    }
    loadPrefixes = function(opts) {
      var browsers, key, stats;
      stats = options.stats;
      browsers = new Browsers(module.exports.data.browsers, reqs, opts, stats);
      key = browsers.selected.join(', ') + JSON.stringify(options);
      return cache[key] || (cache[key] = new Prefixes(module.exports.data.prefixes, browsers, options));
    };
    plugin = function(css, result) {
      var prefixes, ref;
      prefixes = loadPrefixes({
        from: (ref = css.source) != null ? ref.input.file : void 0
      });
      timeCapsule(result, prefixes);
      if (options.remove !== false) {
        prefixes.processor.remove(css);
      }
      if (options.add !== false) {
        return prefixes.processor.add(css, result);
      }
    };
    plugin.options = options;
    plugin.info = function(opts) {
      return require('./info')(loadPrefixes(opts));
    };
    return plugin;
  });

  module.exports.data = {
    browsers: require('caniuse-db/data.json').agents,
    prefixes: require('../data/prefixes')
  };

  module.exports.defaults = browserslist.defaults;

  module.exports.info = function() {
    return module.exports().info();
  };

}).call(this);
