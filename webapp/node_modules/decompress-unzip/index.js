'use strict';

var fs = require('fs');
var isZip = require('is-zip');
var StatMode = require('stat-mode');
var readAllStream = require('read-all-stream');
var stripDirs = require('strip-dirs');
var through = require('through2');
var Vinyl = require('vinyl');
var yauzl = require('yauzl');

module.exports = function (opts) {
	opts = opts || {};
	opts.strip = Number(opts.strip) || 0;

	return through.obj(function (file, enc, cb) {
		var self = this;

		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new Error('Streaming is not supported'));
			return;
		}

		if (!file.extract || !isZip(file.contents)) {
			cb(null, file);
			return;
		}

		yauzl.fromBuffer(file.contents, function (err, zipFile) {
			var count = 0;

			if (err) {
				cb(err);
				return;
			}

			zipFile.on('error', cb);
			zipFile.on('entry', function (entry) {
				var filePath = stripDirs(entry.fileName, opts.strip);

				if (filePath === '.') {
					if (++count === zipFile.entryCount) {
						cb();
					}

					return;
				}

				var stat = new fs.Stats();
				var mode = (entry.externalFileAttributes >> 16) & 0xFFFF;

				stat.mode = mode;

				if (entry.getLastModDate()) {
					stat.mtime = entry.getLastModDate();
				}

				if (entry.fileName.charAt(entry.fileName.length - 1) === '/') {
					if (!mode) {
						new StatMode(stat).isDirectory(true);
					}

					self.push(new Vinyl({
						path: filePath,
						stat: stat
					}));

					if (++count === zipFile.entryCount) {
						cb();
					}

					return;
				}

				zipFile.openReadStream(entry, function (err, readStream) {
					if (err) {
						cb(err);
						return;
					}

					readAllStream(readStream, null, function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						if (!mode) {
							new StatMode(stat).isFile(true);
						}

						self.push(new Vinyl({
							contents: data,
							path: filePath,
							stat: stat
						}));

						if (++count === zipFile.entryCount) {
							cb();
						}
					});
				});
			});
		});
	});
};
