'use strict';
var bufferToVinyl = require('buffer-to-vinyl');
var concatStream = require('concat-stream');
var streamCombiner = require('stream-combiner2');
var vinylFs = require('vinyl-fs');
var vinylAssign = require('vinyl-assign');

/**
 * Initialize Decompress
 *
 * @param {Object} opts
 * @api public
 */

function Decompress(opts) {
	if (!(this instanceof Decompress)) {
		return new Decompress(opts);
	}

	this.opts = opts || {};
	this.streams = [];
}

/**
 * Get or set the source files
 *
 * @param {Array|Buffer|String} file
 * @api public
 */

Decompress.prototype.src = function (file) {
	if (!arguments.length) {
		return this._src;
	}

	this._src = file;
	return this;
};

/**
 * Get or set the destination folder
 *
 * @param {String} dir
 * @api public
 */

Decompress.prototype.dest = function (dir) {
	if (!arguments.length) {
		return this._dest;
	}

	this._dest = dir;
	return this;
};

/**
 * Add a plugin to the middleware stack
 *
 * @param {Function} plugin
 * @api public
 */

Decompress.prototype.use = function (plugin) {
	this.streams.push(plugin);
	return this;
};

/**
 * Decompress archive
 *
 * @param {Function} cb
 * @api public
 */

Decompress.prototype.run = function (cb) {
	cb = cb || function () {};

	var stream = this.createStream();

	stream.on('error', cb);
	stream.pipe(concatStream(cb.bind(null, null)));
};

/**
 * Create stream
 *
 * @api private
 */

Decompress.prototype.createStream = function () {
	this.streams.unshift(vinylAssign({extract: true}));
	this.streams.unshift(this.getFiles());

	if (this.streams.length === 2) {
		this.use(Decompress.tar(this.opts));
		this.use(Decompress.tarbz2(this.opts));
		this.use(Decompress.targz(this.opts));
		this.use(Decompress.zip(this.opts));
	}

	if (this.dest()) {
		this.streams.push(vinylFs.dest(this.dest()));
	}

	return streamCombiner.obj(this.streams);
};

/**
 * Get files
 *
 * @api private
 */

Decompress.prototype.getFiles = function () {
	if (Buffer.isBuffer(this.src())) {
		return bufferToVinyl.stream(this.src());
	}

	return vinylFs.src(this.src());
};

/**
 * Module exports
 */

module.exports = Decompress;
module.exports.tar = require('decompress-tar');
module.exports.tarbz2 = require('decompress-tarbz2');
module.exports.targz = require('decompress-targz');
module.exports.zip = require('decompress-unzip');
