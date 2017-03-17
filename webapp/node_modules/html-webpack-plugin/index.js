'use strict';
var vm = require('vm');
var fs = require('fs');
var _ = require('lodash');
var Promise = require('bluebird');
var path = require('path');
var childCompiler = require('./lib/compiler.js');
var prettyError = require('./lib/errors.js');
var chunkSorter = require('./lib/chunksorter.js');
Promise.promisifyAll(fs);

function HtmlWebpackPlugin (options) {
  // Default options
  this.options = _.extend({
    template: path.join(__dirname, 'default_index.ejs'),
    filename: 'index.html',
    hash: false,
    inject: true,
    compile: true,
    favicon: false,
    minify: false,
    cache: true,
    showErrors: true,
    chunks: 'all',
    excludeChunks: [],
    title: 'Webpack App',
    xhtml: false
  }, options);
}

HtmlWebpackPlugin.prototype.apply = function (compiler) {
  var self = this;
  var isCompilationCached = false;
  var compilationPromise;

  this.options.template = this.getFullTemplatePath(this.options.template, compiler.context);

  // convert absolute filename into relative so that webpack can
  // generate it at correct location
  var filename = this.options.filename;
  if (path.resolve(filename) === path.normalize(filename)) {
    this.options.filename = path.relative(compiler.options.output.path, filename);
  }

  compiler.plugin('make', function (compilation, callback) {
    // Compile the template (queued)
    compilationPromise = childCompiler.compileTemplate(self.options.template, compiler.context, self.options.filename, compilation)
      .catch(function (err) {
        compilation.errors.push(prettyError(err, compiler.context).toString());
        return {
          content: self.options.showErrors ? prettyError(err, compiler.context).toJsonHtml() : 'ERROR',
          outputName: self.options.filename
        };
      })
      .then(function (compilationResult) {
        // If the compilation change didnt change the cache is valid
        isCompilationCached = compilationResult.hash && self.childCompilerHash === compilationResult.hash;
        self.childCompilerHash = compilationResult.hash;
        self.childCompilationOutputName = compilationResult.outputName;
        callback();
        return compilationResult.content;
      });
  });

  compiler.plugin('emit', function (compilation, callback) {
    var applyPluginsAsyncWaterfall = Promise.promisify(compilation.applyPluginsAsyncWaterfall, {context: compilation});
    // Get all chunks
    var chunks = self.filterChunks(compilation.getStats().toJson(), self.options.chunks, self.options.excludeChunks);
    // Sort chunks
    chunks = self.sortChunks(chunks, self.options.chunksSortMode);
    // Let plugins alter the chunks and the chunk sorting
    chunks = compilation.applyPluginsWaterfall('html-webpack-plugin-alter-chunks', chunks, { plugin: self });
    // Get assets
    var assets = self.htmlWebpackPluginAssets(compilation, chunks);
    // If this is a hot update compilation, move on!
    // This solves a problem where an `index.html` file is generated for hot-update js files
    // It only happens in Webpack 2, where hot updates are emitted separately before the full bundle
    if (self.isHotUpdateCompilation(assets)) {
      return callback();
    }

    // If the template and the assets did not change we don't have to emit the html
    var assetJson = JSON.stringify(self.getAssetFiles(assets));
    if (isCompilationCached && self.options.cache && assetJson === self.assetJson) {
      return callback();
    } else {
      self.assetJson = assetJson;
    }

    Promise.resolve()
      // Favicon
      .then(function () {
        if (self.options.favicon) {
          return self.addFileToAssets(self.options.favicon, compilation)
            .then(function (faviconBasename) {
              var publicPath = compilation.options.output.publicPath || '';
              if (publicPath && publicPath.substr(-1) !== '/') {
                publicPath += '/';
              }
              assets.favicon = publicPath + faviconBasename;
            });
        }
      })
      // Wait for the compilation to finish
      .then(function () {
        return compilationPromise;
      })
      .then(function (compiledTemplate) {
        // Allow to use a custom function / string instead
        if (self.options.templateContent) {
          return self.options.templateContent;
        }
        // Once everything is compiled evaluate the html factory
        // and replace it with its content
        return self.evaluateCompilationResult(compilation, compiledTemplate);
      })
      // Allow plugins to make changes to the assets before invoking the template
      // This only makes sense to use if `inject` is `false`
      .then(function (compilationResult) {
        return applyPluginsAsyncWaterfall('html-webpack-plugin-before-html-generation', {
          assets: assets,
          outputName: self.childCompilationOutputName,
          plugin: self
        })
        .then(function () {
          return compilationResult;
        });
      })
      // Execute the template
      .then(function (compilationResult) {
        // If the loader result is a function execute it to retrieve the html
        // otherwise use the returned html
        return typeof compilationResult !== 'function'
          ? compilationResult
          : self.executeTemplate(compilationResult, chunks, assets, compilation);
      })
      // Allow plugins to change the html before assets are injected
      .then(function (html) {
        var pluginArgs = {html: html, assets: assets, plugin: self, outputName: self.childCompilationOutputName};
        return applyPluginsAsyncWaterfall('html-webpack-plugin-before-html-processing', pluginArgs)
          .then(function () {
            return pluginArgs.html;
          });
      })
      .then(function (html) {
        // Prepare script and link tags
        var assetTags = self.generateAssetTags(assets);
        var pluginArgs = {head: assetTags.head, body: assetTags.body, plugin: self, chunks: chunks, outputName: self.childCompilationOutputName};
        // Allow plugins to change the assetTag definitions
        return applyPluginsAsyncWaterfall('html-webpack-plugin-alter-asset-tags', pluginArgs)
          .then(function () {
              // Add the stylesheets, scripts and so on to the resulting html
            return self.postProcessHtml(html, assets, { body: pluginArgs.body, head: pluginArgs.head });
          });
      })
      // Allow plugins to change the html after assets are injected
      .then(function (html) {
        var pluginArgs = {html: html, assets: assets, plugin: self, outputName: self.childCompilationOutputName};
        return applyPluginsAsyncWaterfall('html-webpack-plugin-after-html-processing', pluginArgs)
          .then(function () {
            return pluginArgs.html;
          });
      })
      .catch(function (err) {
        // In case anything went wrong the promise is resolved
        // with the error message and an error is logged
        compilation.errors.push(prettyError(err, compiler.context).toString());
        // Prevent caching
        self.hash = null;
        return self.options.showErrors ? prettyError(err, compiler.context).toHtml() : 'ERROR';
      })
      .then(function (html) {
        // Replace the compilation result with the evaluated html code
        compilation.assets[self.childCompilationOutputName] = {
          source: function () {
            return html;
          },
          size: function () {
            return html.length;
          }
        };
      })
      .then(function () {
        // Let other plugins know that we are done:
        return applyPluginsAsyncWaterfall('html-webpack-plugin-after-emit', {
          html: compilation.assets[self.childCompilationOutputName],
          outputName: self.childCompilationOutputName,
          plugin: self
        }).catch(function (err) {
          console.error(err);
          return null;
        }).then(function () {
          return null;
        });
      })
      // Let webpack continue with it
      .finally(function () {
        callback();
        // Tell blue bird that we don't want to wait for callback.
        // Fixes "Warning: a promise was created in a handler but none were returned from it"
        // https://github.com/petkaantonov/bluebird/blob/master/docs/docs/warning-explanations.md#warning-a-promise-was-created-in-a-handler-but-none-were-returned-from-it
        return null;
      });
  });
};

/**
 * Evaluates the child compilation result
 * Returns a promise
 */
HtmlWebpackPlugin.prototype.evaluateCompilationResult = function (compilation, source) {
  if (!source) {
    return Promise.reject('The child compilation didn\'t provide a result');
  }

  // The LibraryTemplatePlugin stores the template result in a local variable.
  // To extract the result during the evaluation this part has to be removed.
  source = source.replace('var HTML_WEBPACK_PLUGIN_RESULT =', '');
  var template = this.options.template.replace(/^.+!/, '').replace(/\?.+$/, '');
  var vmContext = vm.createContext(_.extend({HTML_WEBPACK_PLUGIN: true, require: require}, global));
  var vmScript = new vm.Script(source, {filename: template});
  // Evaluate code and cast to string
  var newSource;
  try {
    newSource = vmScript.runInContext(vmContext);
  } catch (e) {
    return Promise.reject(e);
  }
  return typeof newSource === 'string' || typeof newSource === 'function'
    ? Promise.resolve(newSource)
    : Promise.reject('The loader "' + this.options.template + '" didn\'t return html.');
};

/**
 * Html post processing
 *
 * Returns a promise
 */
HtmlWebpackPlugin.prototype.executeTemplate = function (templateFunction, chunks, assets, compilation) {
  var self = this;
  return Promise.resolve()
    // Template processing
    .then(function () {
      var templateParams = {
        compilation: compilation,
        webpack: compilation.getStats().toJson(),
        webpackConfig: compilation.options,
        htmlWebpackPlugin: {
          files: assets,
          options: self.options
        }
      };
      var html = '';
      try {
        html = templateFunction(templateParams);
      } catch (e) {
        compilation.errors.push(new Error('Template execution failed: ' + e));
        return Promise.reject(e);
      }
      return html;
    });
};

/**
 * Html post processing
 *
 * Returns a promise
 */
HtmlWebpackPlugin.prototype.postProcessHtml = function (html, assets, assetTags) {
  var self = this;
  if (typeof html !== 'string') {
    return Promise.reject('Expected html to be a string but got ' + JSON.stringify(html));
  }
  return Promise.resolve()
    // Inject
    .then(function () {
      if (self.options.inject) {
        return self.injectAssetsIntoHtml(html, assets, assetTags);
      } else {
        return html;
      }
    })
    // Minify
    .then(function (html) {
      if (self.options.minify) {
        var minify = require('html-minifier').minify;
        return minify(html, self.options.minify);
      }
      return html;
    });
};

/*
 * Pushes the content of the given filename to the compilation assets
 */
HtmlWebpackPlugin.prototype.addFileToAssets = function (filename, compilation) {
  filename = path.resolve(compilation.compiler.context, filename);
  return Promise.props({
    size: fs.statAsync(filename),
    source: fs.readFileAsync(filename)
  })
  .catch(function () {
    return Promise.reject(new Error('HtmlWebpackPlugin: could not load file ' + filename));
  })
  .then(function (results) {
    var basename = path.basename(filename);
    compilation.fileDependencies.push(filename);
    compilation.assets[basename] = {
      source: function () {
        return results.source;
      },
      size: function () {
        return results.size.size;
      }
    };
    return basename;
  });
};

/**
 * Helper to sort chunks
 */
HtmlWebpackPlugin.prototype.sortChunks = function (chunks, sortMode) {
  // Sort mode auto by default:
  if (typeof sortMode === 'undefined') {
    sortMode = 'auto';
  }
  // Custom function
  if (typeof sortMode === 'function') {
    return chunks.sort(sortMode);
  }
  // Disabled sorting:
  if (sortMode === 'none') {
    return chunkSorter.none(chunks);
  }
  // Check if the given sort mode is a valid chunkSorter sort mode
  if (typeof chunkSorter[sortMode] !== 'undefined') {
    return chunkSorter[sortMode](chunks);
  }
  throw new Error('"' + sortMode + '" is not a valid chunk sort mode');
};

/**
 * Return all chunks from the compilation result which match the exclude and include filters
 */
HtmlWebpackPlugin.prototype.filterChunks = function (webpackStatsJson, includedChunks, excludedChunks) {
  return webpackStatsJson.chunks.filter(function (chunk) {
    var chunkName = chunk.names[0];
    // This chunk doesn't have a name. This script can't handled it.
    if (chunkName === undefined) {
      return false;
    }
    // Skip if the chunk should be lazy loaded
    if (!chunk.initial) {
      return false;
    }
    // Skip if the chunks should be filtered and the given chunk was not added explicity
    if (Array.isArray(includedChunks) && includedChunks.indexOf(chunkName) === -1) {
      return false;
    }
    // Skip if the chunks should be filtered and the given chunk was excluded explicity
    if (Array.isArray(excludedChunks) && excludedChunks.indexOf(chunkName) !== -1) {
      return false;
    }
    // Add otherwise
    return true;
  });
};

HtmlWebpackPlugin.prototype.isHotUpdateCompilation = function (assets) {
  return assets.js.length && assets.js.every(function (name) {
    return /\.hot-update\.js$/.test(name);
  });
};

HtmlWebpackPlugin.prototype.htmlWebpackPluginAssets = function (compilation, chunks) {
  var self = this;
  var webpackStatsJson = compilation.getStats().toJson();

  // Use the configured public path or build a relative path
  var publicPath = typeof compilation.options.output.publicPath !== 'undefined'
    // If a hard coded public path exists use it
    ? compilation.mainTemplate.getPublicPath({hash: webpackStatsJson.hash})
    // If no public path was set get a relative url path
    : path.relative(path.resolve(compilation.options.output.path, path.dirname(self.childCompilationOutputName)), compilation.options.output.path)
      .split(path.sep).join('/');

  if (publicPath.length && publicPath.substr(-1, 1) !== '/') {
    publicPath += '/';
  }

  var assets = {
    // The public path
    publicPath: publicPath,
    // Will contain all js & css files by chunk
    chunks: {},
    // Will contain all js files
    js: [],
    // Will contain all css files
    css: [],
    // Will contain the html5 appcache manifest files if it exists
    manifest: Object.keys(compilation.assets).filter(function (assetFile) {
      return path.extname(assetFile) === '.appcache';
    })[0]
  };

  // Append a hash for cache busting
  if (this.options.hash) {
    assets.manifest = self.appendHash(assets.manifest, webpackStatsJson.hash);
    assets.favicon = self.appendHash(assets.favicon, webpackStatsJson.hash);
  }

  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i];
    var chunkName = chunk.names[0];

    assets.chunks[chunkName] = {};

    // Prepend the public path to all chunk files
    var chunkFiles = [].concat(chunk.files).map(function (chunkFile) {
      return publicPath + chunkFile;
    });

    // Append a hash for cache busting
    if (this.options.hash) {
      chunkFiles = chunkFiles.map(function (chunkFile) {
        return self.appendHash(chunkFile, webpackStatsJson.hash);
      });
    }

    // Webpack outputs an array for each chunk when using sourcemaps
    // But we need only the entry file
    var entry = chunkFiles[0];
    assets.chunks[chunkName].size = chunk.size;
    assets.chunks[chunkName].entry = entry;
    assets.chunks[chunkName].hash = chunk.hash;
    assets.js.push(entry);

    // Gather all css files
    var css = chunkFiles.filter(function (chunkFile) {
      // Some chunks may contain content hash in their names, for ex. 'main.css?1e7cac4e4d8b52fd5ccd2541146ef03f'.
      // We must proper handle such cases, so we use regexp testing here
      return /.css($|\?)/.test(chunkFile);
    });
    assets.chunks[chunkName].css = css;
    assets.css = assets.css.concat(css);
  }

  // Duplicate css assets can occur on occasion if more than one chunk
  // requires the same css.
  assets.css = _.uniq(assets.css);

  return assets;
};

/**
 * Injects the assets into the given html string
 */
HtmlWebpackPlugin.prototype.generateAssetTags = function (assets) {
  // Turn script files into script tags
  var scripts = assets.js.map(function (scriptPath) {
    return {
      tagName: 'script',
      closeTag: true,
      attributes: {
        type: 'text/javascript',
        src: scriptPath
      }
    };
  });
  // Make tags self-closing in case of xhtml
  var selfClosingTag = !!this.options.xhtml;
  // Turn css files into link tags
  var styles = assets.css.map(function (stylePath) {
    return {
      tagName: 'link',
      selfClosingTag: selfClosingTag,
      attributes: {
        href: stylePath,
        rel: 'stylesheet'
      }
    };
  });
  // Injection targets
  var head = [];
  var body = [];

  // If there is a favicon present, add it to the head
  if (assets.favicon) {
    head.push({
      tagName: 'link',
      selfClosingTag: selfClosingTag,
      attributes: {
        rel: 'shortcut icon',
        href: assets.favicon
      }
    });
  }
  // Add styles to the head
  head = head.concat(styles);
  // Add scripts to body or head
  if (this.options.inject === 'head') {
    head = head.concat(scripts);
  } else {
    body = body.concat(scripts);
  }
  return {head: head, body: body};
};

/**
 * Injects the assets into the given html string
 */
HtmlWebpackPlugin.prototype.injectAssetsIntoHtml = function (html, assets, assetTags) {
  var htmlRegExp = /(<html[^>]*>)/i;
  var headRegExp = /(<\/head>)/i;
  var bodyRegExp = /(<\/body>)/i;
  var body = assetTags.body.map(this.createHtmlTag);
  var head = assetTags.head.map(this.createHtmlTag);

  if (body.length) {
    if (bodyRegExp.test(html)) {
      // Append assets to body element
      html = html.replace(bodyRegExp, function (match) {
        return body.join('') + match;
      });
    } else {
      // Append scripts to the end of the file if no <body> element exists:
      html += body.join('');
    }
  }

  if (head.length) {
    // Create a head tag if none exists
    if (!headRegExp.test(html)) {
      if (!htmlRegExp.test(html)) {
        html = '<head></head>' + html;
      } else {
        html = html.replace(htmlRegExp, function (match) {
          return match + '<head></head>';
        });
      }
    }

    // Append assets to head element
    html = html.replace(headRegExp, function (match) {
      return head.join('') + match;
    });
  }

  // Inject manifest into the opening html tag
  if (assets.manifest) {
    html = html.replace(/(<html[^>]*)(>)/i, function (match, start, end) {
      // Append the manifest only if no manifest was specified
      if (/\smanifest\s*=/.test(match)) {
        return match;
      }
      return start + ' manifest="' + assets.manifest + '"' + end;
    });
  }
  return html;
};

/**
 * Appends a cache busting hash
 */
HtmlWebpackPlugin.prototype.appendHash = function (url, hash) {
  if (!url) {
    return url;
  }
  return url + (url.indexOf('?') === -1 ? '?' : '&') + hash;
};

/**
 * Turn a tag definition into a html string
 */
HtmlWebpackPlugin.prototype.createHtmlTag = function (tagDefinition) {
  var attributes = Object.keys(tagDefinition.attributes || {}).map(function (attributeName) {
    return attributeName + '="' + tagDefinition.attributes[attributeName] + '"';
  });
  return '<' + [tagDefinition.tagName].concat(attributes).join(' ') + (tagDefinition.selfClosingTag ? '/' : '') + '>' +
    (tagDefinition.innerHTML || '') +
    (tagDefinition.closeTag ? '</' + tagDefinition.tagName + '>' : '');
};

/**
 * Helper to return the absolute template path with a fallback loader
 */
HtmlWebpackPlugin.prototype.getFullTemplatePath = function (template, context) {
  // If the template doesn't use a loader use the lodash template loader
  if (template.indexOf('!') === -1) {
    template = require.resolve('./lib/loader.js') + '!' + path.resolve(context, template);
  }
  // Resolve template path
  return template.replace(
    /([!])([^\/\\][^!\?]+|[^\/\\!?])($|\?.+$)/,
    function (match, prefix, filepath, postfix) {
      return prefix + path.resolve(filepath) + postfix;
    });
};

/**
 * Helper to return a sorted unique array of all asset files out of the
 * asset object
 */
HtmlWebpackPlugin.prototype.getAssetFiles = function (assets) {
  var files = _.uniq(Object.keys(assets).filter(function (assetType) {
    return assetType !== 'chunks' && assets[assetType];
  }).reduce(function (files, assetType) {
    return files.concat(assets[assetType]);
  }, []));
  files.sort();
  return files;
};

module.exports = HtmlWebpackPlugin;
