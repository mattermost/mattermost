'use strict';
var PassThrough = require('stream').PassThrough;
var zlib = require('zlib');

module.exports = function (res) {
	// TODO: use Array#includes when targeting Node.js 6
	if (['gzip', 'deflate'].indexOf(res.headers['content-encoding']) === -1) {
		return res;
	}

	var unzip = zlib.createUnzip();
	var stream = new PassThrough();

	stream.httpVersion = res.httpVersion;
	stream.headers = res.headers;
	stream.rawHeaders = res.rawHeaders;
	stream.trailers = res.trailers;
	stream.rawTrailers = res.rawTrailers;
	stream.setTimeout = res.setTimeout.bind(res);
	stream.statusCode = res.statusCode;
	stream.statusMessage = res.statusMessage;
	stream.socket = res.socket;

	unzip.on('error', function (err) {
		if (err.code === 'Z_BUF_ERROR') {
			stream.end();
			return;
		}

		stream.emit('error', err);
	});

	res.pipe(unzip).pipe(stream);

	return stream;
};
