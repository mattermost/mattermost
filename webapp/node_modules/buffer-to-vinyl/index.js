'use strict';
var fileType = require('file-type');
var PassThrough = require('readable-stream/passthrough');
var uuid = require('uuid');
var Vinyl = require('vinyl');

module.exports.file = function (buf, name) {
	var ext = fileType(buf) ? '.' + fileType(buf).ext : null;

	return new Vinyl({
		contents: buf,
		path: (name || uuid.v4()) + (ext || '')
	});
};

module.exports.stream = function (buf, name) {
	var stream = new PassThrough({objectMode: true});
	stream.end(module.exports.file(buf, name));
	return stream;
};
