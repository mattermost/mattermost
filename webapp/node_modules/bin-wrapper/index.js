'use strict';

var fs = require('fs');
var path = require('path');
var lazyReq = require('lazy-req')(require);
var binCheck = lazyReq('bin-check');
var binVersionCheck = lazyReq('bin-version-check');
var Download = lazyReq('download');
var osFilterObj = lazyReq('os-filter-obj');

/**
 * Initialize a new `BinWrapper`
 *
 * @param {Object} opts
 * @api public
 */

function BinWrapper(opts) {
	if (!(this instanceof BinWrapper)) {
		return new BinWrapper(opts);
	}

	this.opts = opts || {};
	this.opts.strip = this.opts.strip <= 0 ? 0 : !this.opts.strip ? 1 : this.opts.strip;
}

module.exports = BinWrapper;

/**
 * Get or set files to download
 *
 * @param {String} src
 * @param {String} os
 * @param {String} arch
 * @api public
 */

BinWrapper.prototype.src = function (src, os, arch) {
	if (!arguments.length) {
		return this._src;
	}

	this._src = this._src || [];
	this._src.push({
		url: src,
		os: os,
		arch: arch
	});

	return this;
};

/**
 * Get or set the destination
 *
 * @param {String} dest
 * @api public
 */

BinWrapper.prototype.dest = function (dest) {
	if (!arguments.length) {
		return this._dest;
	}

	this._dest = dest;
	return this;
};

/**
 * Get or set the binary
 *
 * @param {String} bin
 * @api public
 */

BinWrapper.prototype.use = function (bin) {
	if (!arguments.length) {
		return this._use;
	}

	this._use = bin;
	return this;
};

/**
 * Get or set a semver range to test the binary against
 *
 * @param {String} range
 * @api public
 */

BinWrapper.prototype.version = function (range) {
	if (!arguments.length) {
		return this._version;
	}

	this._version = range;
	return this;
};

/**
 * Get path to the binary
 *
 * @api public
 */

BinWrapper.prototype.path = function () {
	return path.join(this.dest(), this.use());
};

/**
 * Run
 *
 * @param {Array} cmd
 * @param {Function} cb
 * @api public
 */

BinWrapper.prototype.run = function (cmd, cb) {
	if (typeof cmd === 'function' && !cb) {
		cb = cmd;
		cmd = ['--version'];
	}

	this.findExisting(function (err) {
		if (err) {
			cb(err);
			return;
		}

		if (this.opts.skipCheck) {
			cb();
			return;
		}

		this.runCheck(cmd, cb);
	}.bind(this));
};

/**
 * Run binary check
 *
 * @param {Array} cmd
 * @param {Function} cb
 * @api private
 */

BinWrapper.prototype.runCheck = function (cmd, cb) {
	binCheck()(this.path(), cmd, function (err, works) {
		if (err) {
			cb(err);
			return;
		}

		if (!works) {
			cb(new Error('The `' + this.path() + '` binary doesn\'t seem to work correctly'));
			return;
		}

		if (this.version()) {
			return binVersionCheck()(this.path(), this.version(), cb);
		}

		cb();
	}.bind(this));
};

/**
 * Find existing files
 *
 * @param {Function} cb
 * @api private
 */

BinWrapper.prototype.findExisting = function (cb) {
	fs.stat(this.path(), function (err) {
		if (err && err.code === 'ENOENT') {
			this.download(cb);
			return;
		}

		if (err) {
			cb(err);
			return;
		}

		cb();
	}.bind(this));
};

/**
 * Download files
 *
 * @param {Function} cb
 * @api private
 */

BinWrapper.prototype.download = function (cb) {
	var files = osFilterObj()(this.src());
	var download = new Download()({
		extract: true,
		mode: '755',
		strip: this.opts.strip
	});

	if (!files.length) {
		cb(new Error('No binary found matching your system. It\'s probably not supported.'));
		return;
	}

	files.forEach(function (file) {
		download.get(file.url);
	});

	download
		.dest(this.dest())
		.run(cb);
};
