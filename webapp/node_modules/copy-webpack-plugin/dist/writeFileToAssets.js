'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _crypto = require('crypto');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable import/no-commonjs */
var fs = _bluebird2.default.promisifyAll(require('fs-extra'));
/* eslint-enable */

exports.default = function (opts) {
    var compilation = opts.compilation;
    // ensure forward slashes
    var relFileDest = opts.relFileDest.replace(/\\/g, '/');
    var absFileSrc = opts.absFileSrc;
    var forceWrite = opts.forceWrite;
    var copyUnmodified = opts.copyUnmodified;
    var writtenAssetHashes = opts.writtenAssetHashes;

    if (compilation.assets[relFileDest] && !forceWrite) {
        return _bluebird2.default.resolve();
    }

    return fs.statAsync(absFileSrc).then(function (stat) {

        // We don't write empty directories
        if (stat.isDirectory()) {
            return;
        }

        function addToAssets() {
            compilation.assets[relFileDest] = {
                size: function size() {
                    return stat.size;
                },
                source: function source() {
                    return fs.readFileSync(absFileSrc);
                }
            };

            return relFileDest;
        }

        if (copyUnmodified) {
            return addToAssets();
        }

        return fs.readFileAsync(absFileSrc).then(function (contents) {
            var hash = (0, _crypto.createHash)('sha256').update(contents).digest('hex');
            if (writtenAssetHashes[relFileDest] && writtenAssetHashes[relFileDest] === hash) {
                return;
            }

            writtenAssetHashes[relFileDest] = hash;
            return addToAssets();
        });
    });
};