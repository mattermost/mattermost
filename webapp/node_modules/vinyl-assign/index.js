'use strict';
var objectAssign = require('object-assign');
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
				cb(new Error('Streaming is not supported'));
				return;
			}

			cb(null, objectAssign(file, opts));
		}
	});
};
