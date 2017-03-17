'use strict';

var archiveType = require('archive-type');
var Decompress = require('decompress');
var gutil = require('gulp-util');
var Transform = require('readable-stream/transform');

module.exports = function (opts) {
	opts = opts || {};

	return new Transform({
		objectMode: true,
		transform: function (file, enc, cb) {
			if (file.isNull()) {
				cb(null, file);
				return;
			}

			if (file.isStream()) {
				cb(new gutil.PluginError('gulp-decompress', 'Streaming is not supported'));
				return;
			}

			if (!archiveType(file.contents)) {
				cb(null, file);
				return;
			}

			var decompress = new Decompress()
				.src(file.contents)
				.use(Decompress.tar(opts))
				.use(Decompress.tarbz2(opts))
				.use(Decompress.targz(opts))
				.use(Decompress.zip(opts));

			decompress.run(function (err, files) {
				if (err) {
					cb(new gutil.PluginError('gulp-decompress:', err, {fileName: file.path}));
					return;
				}

				files.forEach(this.push.bind(this));
				cb();
			}.bind(this));
		}
	});
};
