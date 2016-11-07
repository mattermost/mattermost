'use strict';
var path = require('path');
var url = require('url');
var caw = require('caw');
var concatStream = require('concat-stream');
var decompress = require('gulp-decompress');
var eachAsync = require('each-async');
var filenamify = require('filenamify');
var got = require('got');
var isUrl = require('is-url');
var objectAssign = require('object-assign');
var readAllStream = require('read-all-stream');
var rename = require('gulp-rename');
var streamCombiner = require('stream-combiner2');
var PassThrough = require('readable-stream/passthrough');
var Vinyl = require('vinyl');
var vinylFs = require('vinyl-fs');
var Ware = require('ware');

/**
 * Initialize a new `Download`
 *
 * @param {Object} opts
 * @api public
 */

function Download(opts) {
	if (!(this instanceof Download)) {
		return new Download(opts);
	}

	this.opts = objectAssign({encoding: null}, opts);
	this.ware = new Ware();
}

module.exports = Download;

/**
 * Get or set URL to download
 *
 * @param {String} url
 * @param {String} dest
 * @api public
 */

Download.prototype.get = function (url, dest) {
	if (!arguments.length) {
		return this._get;
	}

	this._get = this._get || [];
	this._get.push({
		url: url,
		dest: dest
	});

	return this;
};

/**
 * Get or set the destination folder
 *
 * @param {String} dir
 * @api public
 */

Download.prototype.dest = function (dir) {
	if (!arguments.length) {
		return this._dest;
	}

	this._dest = dir;
	return this;
};

/**
 * Rename the downloaded file
 *
 * @param {Function|String} name
 * @api public
 */

Download.prototype.rename = function (name) {
	if (!arguments.length) {
		return this._rename;
	}

	this._rename = name;
	return this;
};

/**
 * Add a plugin to the middleware stack
 *
 * @param {Function} plugin
 * @api public
 */

Download.prototype.use = function (plugin) {
	this.ware.use(plugin);
	return this;
};

/**
 * Run
 *
 * @param {Function} cb
 * @api public
 */

Download.prototype.run = function (cb) {
	cb = cb || function () {};
	var files = [];

	eachAsync(this.get(), function (get, i, done) {
		if (!isUrl(get.url)) {
			done(new Error('Specify a valid URL'));
			return;
		}

		var protocol = url.parse(get.url).protocol;
		if (protocol) {
			protocol = protocol.slice(0, -1);
		}
		var agent = caw(this.opts.proxy, {protocol: protocol});
		var stream = got.stream(get.url, objectAssign(this.opts, {agent: agent}));

		stream.on('response', function (res) {
			stream.headers = res.headers;
			stream.statusCode = res.statusCode;
			this.ware.run(stream, get.url);
		}.bind(this));

		var hasHttpError = false;

		readAllStream(stream, null, function (err, data) {
			if (hasHttpError) {
				return;
			}

			if (err) {
				if (err instanceof got.HTTPError) {
					hasHttpError = true;
				}

				done(err);
				return;
			}

			var dest = get.dest || this.dest();
			var fileStream = this.createStream(this.createFile(get.url, data), dest);

			fileStream.on('error', done);
			fileStream.pipe(concatStream({encoding: 'object'}, function (items) {
				files = files.concat(items);
				done();
			}));
		}.bind(this));
	}.bind(this), function (err) {
		if (err) {
			cb(err);
			return;
		}

		cb(null, files);
	});
};

/**
 * Create vinyl file
 *
 * @param {String} url
 * @param {Buffer} data
 * @api private
 */

Download.prototype.createFile = function (url, data) {
	return objectAssign(new Vinyl({
		contents: data,
		path: filenamify(path.basename(url))
	}), {url: url});
};

/**
 * Create stream
 *
 * @param {Object} file
 * @param {String} dest
 * @api private
 */

Download.prototype.createStream = function (file, dest) {
	var stream = new PassThrough({objectMode: true});
	var streams = [stream];

	stream.end(file);

	if (this.opts.extract) {
		streams.push(decompress(this.opts));
	}

	if (this.rename()) {
		streams.push(rename(this.rename()));
	}

	if (dest) {
		streams.push(vinylFs.dest(dest, this.opts));
	}

	return streamCombiner.obj(streams);
};
