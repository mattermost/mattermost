'use strict';
var fs = require('fs');
var archiveType = require('archive-type');
var execSeries = require('exec-series');
var Decompress = require('decompress');
var Download = require('download');
var rimraf = require('rimraf');
var tempfile = require('tempfile');
var urlRegex = require('url-regex');

/**
 * Initialize new `BinBuild`
 *
 * @param {Object} opts
 * @api public
 */

function BinBuild(opts) {
	if (!(this instanceof BinBuild)) {
		return new BinBuild(opts);
	}

	this.opts = opts || {};
	this.tmp = tempfile();

	if (this.opts.strip <= 0) {
		this.opts.strip = 0;
	} else if (!this.opts.strip) {
		this.opts.strip = 1;
	}
}

module.exports = BinBuild;

/**
 * Define the source archive to download
 *
 * @param {String} str
 * @api public
 */

BinBuild.prototype.src = function (str) {
	if (!arguments.length) {
		return this._src;
	}

	this._src = str;
	return this;
};

/**
 * Add a command to run
 *
 * @param {String} str
 * @api public
 */

BinBuild.prototype.cmd = function (str) {
	if (!arguments.length) {
		return this._cmd;
	}

	this._cmd = this._cmd || [];
	this._cmd.push(str);

	return this;
};

/**
 * Build
 *
 * @param {Function} cb
 * @api public
 */

BinBuild.prototype.run = function (cb) {
	cb = cb || function () {};

	if (urlRegex().test(this.src())) {
		return this.download(function (err) {
			if (err) {
				cb(err);
				return;
			}

			this.exec(this.tmp, cb);
		}.bind(this));
	}

	fs.readFile(this.src(), function (err, data) {
		if (err && err.code !== 'EISDIR') {
			cb(err);
			return;
		}

		if (archiveType(data)) {
			this.extract(function (err) {
				if (err) {
					cb(err);
					return;
				}

				this.exec(this.tmp, cb);
			}.bind(this));

			return;
		}

		this.exec(this.src(), cb);
	}.bind(this));
};

/**
 * Execute commands
 *
 * @param {String} cwd
 * @param {Function} cb
 * @api private
 */

BinBuild.prototype.exec = function (cwd, cb) {
	execSeries(this.cmd(), {cwd: cwd}, function (err) {
		if (err) {
			err.message = [this.cmd().join(' && '), err.message].join('\n');
			cb(err);
			return;
		}

		rimraf(this.tmp, cb);
	}.bind(this));
};

/**
 * Decompress source
 *
 * @param {Function} cb
 * @api private
 */

BinBuild.prototype.extract = function (cb) {
	var decompress = new Decompress({
		mode: '777',
		strip: this.opts.strip
	});

	decompress
		.src(this.src())
		.dest(this.tmp)
		.run(cb);
};

/**
 * Download source file
 *
 * @param {Function} cb
 * @api private
 */

BinBuild.prototype.download = function (cb) {
	var download = new Download({
		strip: this.opts.strip,
		extract: true,
		mode: '777'
	});

	download
		.get(this.src())
		.dest(this.tmp)
		.run(cb);
};
