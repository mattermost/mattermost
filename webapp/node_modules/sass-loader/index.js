'use strict';

var utils = require('loader-utils');
var sass = require('node-sass');
var path = require('path');
var os = require('os');
var fs = require('fs');
var async = require('async');
var assign = require('object-assign');

// A typical sass error looks like this
var SassError = {
    message: 'invalid property name',
    column: 14,
    line: 1,
    file: 'stdin',
    status: 1
};

// libsass uses this precedence when importing files without extension
var slice = Array.prototype.slice;
var extPrecedence = ['.scss', '.sass', '.css'];
var matchCss = /\.css$/;

// This queue makes sure node-sass leaves one thread available for executing
// fs tasks when running the custom importer code.
// This can be removed as soon as node-sass implements a fix for this.
var threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4;
var asyncSassJobQueue = async.queue(sass.render, threadPoolSize - 1);

/**
 * The sass-loader makes node-sass available to webpack modules.
 *
 * @param {string} content
 * @returns {string}
 */
module.exports = function (content) {
    var callback = this.async();
    var isSync = typeof callback !== 'function';
    var self = this;
    var resourcePath = this.resourcePath;
    var sassOptions = getLoaderConfig(this);
    var result;

    /**
     * Enhances the sass error with additional information about what actually went wrong.
     *
     * @param {SassError} err
     */
    function formatSassError(err) {
        // Instruct webpack to hide the JS stack from the console
        // Usually you're only interested in the SASS stack in this case.
        err.hideStack = true;

        // The file property is missing in rare cases.
        // No improvement in the error is possible.
        if (!err.file) {
            return;
        }

        var msg = err.message;

        if (err.file === 'stdin') {
            err.file = resourcePath;
        }
        // node-sass returns UNIX-style paths
        err.file = path.normalize(err.file);

        // The 'Current dir' hint of node-sass does not help us, we're providing
        // additional information by reading the err.file property
        msg = msg.replace(/\s*Current dir:\s*/, '');

        err.message = getFileExcerptIfPossible(err) +
            msg.charAt(0).toUpperCase() + msg.slice(1) + os.EOL +
            '      in ' + err.file + ' (line ' + err.line + ', column ' + err.column + ')';
    }

    /**
     * Returns an importer that uses webpack's resolving algorithm.
     *
     * It's important that the returned function has the correct number of arguments
     * (based on whether the call is sync or async) because otherwise node-sass doesn't exit.
     *
     * @returns {function}
     */
    function getWebpackImporter() {
        if (isSync) {
            return function syncWebpackImporter(url, fileContext) {
                var dirContext;
                var request;

                // node-sass returns UNIX-style paths
                fileContext = path.normalize(fileContext);
                request = utils.urlToRequest(url, sassOptions.root);
                dirContext = fileToDirContext(fileContext);

                return resolveSync(dirContext, url, getImportsToResolve(request));
            };
        }
        return function asyncWebpackImporter(url, fileContext, done) {
            var dirContext;
            var request;

            // node-sass returns UNIX-style paths
            fileContext = path.normalize(fileContext);
            request = utils.urlToRequest(url, sassOptions.root);
            dirContext = fileToDirContext(fileContext);

            resolve(dirContext, url, getImportsToResolve(request), done);
        };
    }

    /**
     * Tries to resolve the first url of importsToResolve. If that resolve fails, the next url is tried.
     * If all imports fail, the import is passed to libsass which also take includePaths into account.
     *
     * @param {string} dirContext
     * @param {string} originalImport
     * @param {Array} importsToResolve
     * @returns {object}
     */
    function resolveSync(dirContext, originalImport, importsToResolve) {
        var importToResolve = importsToResolve.shift();
        var resolvedFilename;

        if (!importToResolve) {
            // No import possibilities left. Let's pass that one back to libsass...
            return {
                file: originalImport
            };
        }

        try {
            resolvedFilename = self.resolveSync(dirContext, importToResolve);
            // Add the resolvedFilename as dependency. Although we're also using stats.includedFiles, this might come
            // in handy when an error occurs. In this case, we don't get stats.includedFiles from node-sass.
            addNormalizedDependency(resolvedFilename);
            // By removing the CSS file extension, we trigger node-sass to include the CSS file instead of just linking it.
            resolvedFilename = resolvedFilename.replace(matchCss, '');
            return {
                file: resolvedFilename
            };
        } catch (err) {
            return resolveSync(dirContext, originalImport, importsToResolve);
        }
    }

    /**
     * Tries to resolve the first url of importsToResolve. If that resolve fails, the next url is tried.
     * If all imports fail, the import is passed to libsass which also take includePaths into account.
     *
     * @param {string} dirContext
     * @param {string} originalImport
     * @param {Array} importsToResolve
     * @param {function} done
     */
    function resolve(dirContext, originalImport, importsToResolve, done) {
        var importToResolve = importsToResolve.shift();

        if (!importToResolve) {
            // No import possibilities left. Let's pass that one back to libsass...
            done({
                file: originalImport
            });
            return;
        }

        self.resolve(dirContext, importToResolve, function onWebpackResolve(err, resolvedFilename) {
            if (err) {
                resolve(dirContext, originalImport, importsToResolve, done);
                return;
            }
            // Add the resolvedFilename as dependency. Although we're also using stats.includedFiles, this might come
            // in handy when an error occurs. In this case, we don't get stats.includedFiles from node-sass.
            addNormalizedDependency(resolvedFilename);
            // By removing the CSS file extension, we trigger node-sass to include the CSS file instead of just linking it.
            resolvedFilename = resolvedFilename.replace(matchCss, '');

            // Use self.loadModule() before calling done() to make imported files available to
            // other webpack tools like postLoaders etc.?

            done({
                file: resolvedFilename.replace(matchCss, '')
            });
        });
    }

    function fileToDirContext(fileContext) {
        // The first file is 'stdin' when we're using the data option
        if (fileContext === 'stdin') {
            fileContext = resourcePath;
        }
        return path.dirname(fileContext);
    }

    // When files have been imported via the includePaths-option, these files need to be
    // introduced to webpack in order to make them watchable.
    function addIncludedFilesToWebpack(includedFiles) {
        includedFiles.forEach(addNormalizedDependency);
    }

    function addNormalizedDependency(file) {
        // node-sass returns UNIX-style paths
        self.dependency(path.normalize(file));
    }

    this.cacheable();

    sassOptions.data = sassOptions.data ? (sassOptions.data + os.EOL + content) : content;

    // Skip empty files, otherwise it will stop webpack, see issue #21
    if (sassOptions.data.trim() === '') {
        return isSync ? content : callback(null, content);
    }

    // opt.outputStyle
    if (!sassOptions.outputStyle && this.minimize) {
        sassOptions.outputStyle = 'compressed';
    }

    // opt.sourceMap
    // Not using the `this.sourceMap` flag because css source maps are different
    // @see https://github.com/webpack/css-loader/pull/40
    if (sassOptions.sourceMap) {
        // deliberately overriding the sourceMap option
        // this value is (currently) ignored by libsass when using the data input instead of file input
        // however, it is still necessary for correct relative paths in result.map.sources.
        sassOptions.sourceMap = this.options.context + '/sass.map';
        sassOptions.omitSourceMapUrl = true;

        // If sourceMapContents option is not set, set it to true otherwise maps will be empty/null
        // when exported by webpack-extract-text-plugin.
        if ('sourceMapContents' in sassOptions === false) {
            sassOptions.sourceMapContents = true;
        }
    }

    // indentedSyntax is a boolean flag.
    var ext = path.extname(resourcePath);

    // If we are compiling sass and indentedSyntax isn't set, automatically set it.
    if (ext && ext.toLowerCase() === '.sass' && sassOptions.indentedSyntax === undefined) {
        sassOptions.indentedSyntax = true;
    } else {
        sassOptions.indentedSyntax = Boolean(sassOptions.indentedSyntax);
    }

    // Allow passing custom importers to `node-sass`. Accepts `Function` or an array of `Function`s.
    sassOptions.importer = sassOptions.importer ? proxyCustomImporters(sassOptions.importer, resourcePath) : [];
    sassOptions.importer.push(getWebpackImporter());

    // `node-sass` uses `includePaths` to resolve `@import` paths. Append the currently processed file.
    sassOptions.includePaths = sassOptions.includePaths ? [].concat(sassOptions.includePaths) : [];
    sassOptions.includePaths.push(path.dirname(resourcePath));

    // start the actual rendering
    if (isSync) {
        try {
            result = sass.renderSync(sassOptions);
            addIncludedFilesToWebpack(result.stats.includedFiles);
            return result.css.toString();
        } catch (err) {
            formatSassError(err);
            err.file && this.dependency(err.file);
            throw err;
        }
    }

    asyncSassJobQueue.push(sassOptions, function onRender(err, result) {
        if (err) {
            formatSassError(err);
            err.file && self.dependency(err.file);
            callback(err);
            return;
        }

        if (result.map && result.map !== '{}') {
            result.map = JSON.parse(result.map);
            result.map.file = resourcePath;
            // The first source is 'stdin' according to libsass because we've used the data input
            // Now let's override that value with the correct relative path
            result.map.sources[0] = path.relative(self.options.context, resourcePath);
            result.map.sourceRoot = path.relative(self.options.context, process.cwd());
        } else {
            result.map = null;
        }

        addIncludedFilesToWebpack(result.stats.includedFiles);
        callback(null, result.css.toString(), result.map);
    });
};

/**
 * Tries to get an excerpt of the file where the error happened.
 * Uses err.line and err.column.
 *
 * Returns an empty string if the excerpt could not be retrieved.
 *
 * @param {SassError} err
 * @returns {string}
 */
function getFileExcerptIfPossible(err) {
    var content;

    try {
        content = fs.readFileSync(err.file, 'utf8');

        return os.EOL +
            content.split(os.EOL)[err.line - 1] + os.EOL +
            new Array(err.column - 1).join(' ') + '^' + os.EOL +
            '      ';
    } catch (err) {
        // If anything goes wrong here, we don't want any errors to be reported to the user
        return '';
    }
}

/**
 * When libsass tries to resolve an import, it uses this "funny" algorithm:
 *
 * - Imports with no file extension:
 *   - Prefer modules starting with '_'
 *   - File extension precedence: .scss, .sass, .css
 * - Imports with file extension:
 *   - If the file is a CSS-file, do not include it all, but just link it via @import url()
 *   - The exact file name must match (no auto-resolving of '_'-modules)
 *
 * Since the sass-loader uses webpack to resolve the modules, we need to simulate that algorithm. This function
 * returns an array of import paths to try.
 *
 * @param {string} originalImport
 * @returns {Array}
 */
function getImportsToResolve(originalImport) {
    var ext = path.extname(originalImport);
    var basename = path.basename(originalImport);
    var dirname = path.dirname(originalImport);
    var startsWithUnderscore = basename.charAt(0) === '_';
    var paths = [];

    function add(file) {
        // No path.sep required here, because imports inside SASS are usually with /
        paths.push(dirname + '/' + file);
    }

    if (originalImport.charAt(0) !== '.') {
        // If true: originalImport is a module import like 'bootstrap-sass...'
        if (dirname === '.') {
            // If true: originalImport is just a module import without a path like 'bootstrap-sass'
            // In this case we don't do that auto-resolving dance at all.
            return [originalImport];
        }
    }

    // We can't just check for ext being defined because ext can also be something like '.datepicker'
    // when the true extension is omitted and the filename contains a dot.
    // @see https://github.com/jtangelder/sass-loader/issues/167
    /*jshint noempty:false */
    if (ext === '.css') {
        // do not import css files
    } else if (ext === '.scss' || ext === '.sass') {
    /*jshint noempty:true */
        add(basename);
    } else {
        if (!startsWithUnderscore) {
            // Prefer modules starting with '_' first
            extPrecedence.forEach(function (ext) {
                add('_' + basename + ext);
            });
        }
        extPrecedence.forEach(function (ext) {
            add(basename + ext);
        });
    }

    return paths;
}

/**
 * Check the loader query and webpack config for loader options. If an option is defined in both places,
 * the loader query takes precedence.
 *
 * @param {Loader} loaderContext
 * @returns {Object}
 */
function getLoaderConfig(loaderContext) {
    var query = utils.parseQuery(loaderContext.query);
    var configKey = query.config || 'sassLoader';
    var config = loaderContext.options[configKey] || {};

    delete query.config;

    return assign({}, config, query);
}

/**
 * Creates new custom importers that use the given `resourcePath` if libsass calls the custom importer with `prev`
 * being 'stdin'.
 *
 * Why do we need this?
 *
 * We have to use the `data` option of node-sass in order to compile our sass because the `resourcePath` might
 * not be an actual file on disk. When using the `data` option, libsass uses the string 'stdin' instead of a
 * filename. We have to fix this behavior in order to provide a consistent experience to the webpack user.
 *
 * @param {function|Array<function>} importer
 * @param {string} resourcePath
 * @returns {Array<function>}
 */
function proxyCustomImporters(importer, resourcePath) {
    return [].concat(importer).map(function (importer) {
        return function (url, prev, done) {
            var args = slice.call(arguments);
            
            if (args[1] === 'stdin') {
                args[1] = resourcePath;
            }
            
            return importer.apply(this, args);
        };
    });
}
