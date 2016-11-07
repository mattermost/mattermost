'use strict';

var File = require('vinyl');
var fs = require('fs');
var isGzip = require('is-gzip');
var objectAssign = require('object-assign');
var stripDirs = require('strip-dirs');
var tar = require('tar-stream');
var through = require('through2');
var zlib = require('zlib');

module.exports = function (opts) {
	opts = opts || {};
	opts.strip = +opts.strip || 0;

	return through.obj(function (file, enc, cb) {
		var self = this;
		var extract = tar.extract();
		var unzip = zlib.Unzip();

		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new Error('Streaming is not supported'));
			return;
		}

		if (!file.extract || !isGzip(file.contents)) {
			cb(null, file);
			return;
		}

		extract.on('entry', function (header, stream, done) {
			var chunk = [];
			var len = 0;

			stream.on('data', function (data) {
				chunk.push(data);
				len += data.length;
			});

			stream.on('end', function () {
				if (header.type !== 'directory') {
					self.push(new File({
						contents: Buffer.concat(chunk, len),
						path: stripDirs(header.name, opts.strip),
						stat: objectAssign(new fs.Stats(), header)
					}));
				}

				done();
			});
		});

		extract.on('finish', cb);
		extract.on('error', cb);
		unzip.end(file.contents);
		unzip.pipe(extract);
	});
};
