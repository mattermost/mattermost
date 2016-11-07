'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _toLooksLikeDirectory = require('./toLooksLikeDirectory');

var _toLooksLikeDirectory2 = _interopRequireDefault(_toLooksLikeDirectory);

var _writeFileToAssets = require('./writeFileToAssets');

var _writeFileToAssets2 = _interopRequireDefault(_writeFileToAssets);

var _writeDirectoryToAssets = require('./writeDirectoryToAssets');

var _writeDirectoryToAssets2 = _interopRequireDefault(_writeDirectoryToAssets);

var _shouldIgnore = require('./shouldIgnore');

var _shouldIgnore2 = _interopRequireDefault(_shouldIgnore);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable import/no-commonjs */
var globAsync = _bluebird2.default.promisify(require('glob'));
var fs = _bluebird2.default.promisifyAll(require('fs-extra'));
/* eslint-enable */

function CopyWebpackPlugin() {
    var patterns = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    if (!_lodash2.default.isArray(patterns)) {
        throw new Error('CopyWebpackPlugin: patterns must be an array');
    }

    var apply = function apply(compiler) {
        var webpackContext = compiler.options.context;
        var outputPath = compiler.options.output.path;
        var fileDependencies = [];
        var contextDependencies = [];
        var webpackIgnore = options.ignore || [];
        var copyUnmodified = options.copyUnmodified;
        var writtenAssetHashes = {};

        compiler.plugin('emit', function (compilation, cb) {

            _bluebird2.default.each(patterns, function (pattern) {
                var relDest = void 0;
                var globOpts = void 0;

                if (pattern.context && !_path2.default.isAbsolute(pattern.context)) {
                    pattern.context = _path2.default.resolve(webpackContext, pattern.context);
                }

                var context = pattern.context || webpackContext;
                var ignoreList = webpackIgnore.concat(pattern.ignore || []);

                globOpts = {
                    cwd: context
                };

                // From can be an object
                if (pattern.from.glob) {
                    globOpts = _lodash2.default.assignIn(globOpts, _lodash2.default.omit(pattern.from, 'glob'));
                    pattern.from = pattern.from.glob;
                }

                var relSrc = pattern.from;
                var absSrc = _path2.default.resolve(context, relSrc);

                relDest = pattern.to || '';

                var forceWrite = Boolean(pattern.force);

                return fs.statAsync(absSrc).catch(function () {
                    return null;
                }).then(function (stat) {
                    if (stat && stat.isDirectory()) {
                        contextDependencies.push(absSrc);

                        // Make the relative destination actually relative
                        if (_path2.default.isAbsolute(relDest)) {
                            relDest = _path2.default.relative(outputPath, relDest);
                        }

                        return (0, _writeDirectoryToAssets2.default)({
                            absDirSrc: absSrc,
                            compilation: compilation,
                            copyUnmodified: copyUnmodified,
                            flatten: pattern.flatten,
                            forceWrite: forceWrite,
                            ignoreList: ignoreList,
                            relDirDest: relDest,
                            writtenAssetHashes: writtenAssetHashes
                        });
                    }

                    return globAsync(relSrc, globOpts).each(function (relFileSrcParam) {
                        var relFileDest = void 0;
                        var relFileSrc = void 0;

                        relFileSrc = relFileSrcParam;

                        // Skip if it matches any of our ignore list
                        if ((0, _shouldIgnore2.default)(relFileSrc, ignoreList)) {
                            return false;
                        }

                        var absFileSrc = _path2.default.resolve(context, relFileSrc);

                        relFileDest = pattern.to || '';

                        // Remove any directory references if flattening
                        if (pattern.flatten) {
                            relFileSrc = _path2.default.basename(relFileSrc);
                        }

                        var relFileDirname = _path2.default.dirname(relFileSrc);

                        fileDependencies.push(absFileSrc);

                        // If the pattern is a blob
                        if (!stat) {
                            // If the source is absolute
                            if (_path2.default.isAbsolute(relFileSrc)) {
                                // Make the destination relative
                                relFileDest = _path2.default.join(_path2.default.relative(context, relFileDirname), _path2.default.basename(relFileSrc));

                                // If the source is relative
                            } else {
                                    relFileDest = _path2.default.join(relFileDest, relFileSrc);
                                }

                            // If it looks like a directory
                        } else if ((0, _toLooksLikeDirectory2.default)(pattern)) {
                                // Make the path relative to the source
                                relFileDest = _path2.default.join(relFileDest, _path2.default.basename(relFileSrc));
                            }

                        // If there's still no relFileDest
                        relFileDest = relFileDest || _path2.default.basename(relFileSrc);

                        // Make sure the relative destination is actually relative
                        if (_path2.default.isAbsolute(relFileDest)) {
                            relFileDest = _path2.default.relative(outputPath, relFileDest);
                        }

                        return (0, _writeFileToAssets2.default)({
                            absFileSrc: absFileSrc,
                            compilation: compilation,
                            copyUnmodified: copyUnmodified,
                            forceWrite: forceWrite,
                            relFileDest: relFileDest,
                            writtenAssetHashes: writtenAssetHashes
                        });
                    });
                });
            }).catch(function (err) {
                compilation.errors.push(err);
            }).finally(cb);
        });

        compiler.plugin('after-emit', function (compilation, callback) {
            var trackedFiles = compilation.fileDependencies;

            _lodash2.default.forEach(fileDependencies, function (file) {
                if (!_lodash2.default.includes(trackedFiles, file)) {
                    trackedFiles.push(file);
                }
            });

            var trackedDirs = compilation.contextDependencies;

            _lodash2.default.forEach(contextDependencies, function (context) {
                if (!_lodash2.default.includes(trackedDirs, context)) {
                    trackedDirs.push(context);
                }
            });

            callback();
        });
    };

    return {
        apply: apply
    };
}

CopyWebpackPlugin['default'] = CopyWebpackPlugin;
module.exports = CopyWebpackPlugin;