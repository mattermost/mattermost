'use strict';
var firstChunk = require('first-chunk-stream');
var stripBom = require('strip-bom');

module.exports = function () {
	return firstChunk({minSize: 3}, function (chunk, enc, cb) {
		this.push(stripBom(chunk));
		cb();
	});
};
