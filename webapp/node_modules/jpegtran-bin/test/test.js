'use strict';
/* eslint-env mocha */
var assert = require('assert');
var execFile = require('child_process').execFile;
var fs = require('fs');
var path = require('path');
var BinBuild = require('bin-build');
var binCheck = require('bin-check');
var compareSize = require('compare-size');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var tmp = path.join(__dirname, 'tmp');

beforeEach(function () {
	mkdirp.sync(tmp);
});

afterEach(function () {
	rimraf.sync(tmp);
});

it('rebuild the jpegtran binaries', function (cb) {
	var cfg = [
		'./configure --disable-shared',
		'--prefix="' + tmp + '" --bindir="' + tmp + '"'
	].join(' ');

	new BinBuild()
		.src('https://downloads.sourceforge.net/project/libjpeg-turbo/1.5.0/libjpeg-turbo-1.5.0.tar.gz')
		.cmd(cfg)
		.cmd('make install')
		.run(function (err) {
			if (err) {
				cb(err);
				return;
			}

			assert(fs.statSync(path.join(tmp, 'jpegtran')).isFile());
			cb();
		});
});

it('return path to binary and verify that it is working', function () {
	var args = [
		'-outfile', path.join(tmp, 'test.jpg'),
		path.join(__dirname, 'fixtures/test.jpg')
	];

	return binCheck(require('../'), args).then(assert);
});

it('minify a JPG', function (cb) {
	var src = path.join(__dirname, 'fixtures/test.jpg');
	var dest = path.join(tmp, 'test.jpg');
	var args = [
		'-outfile', dest,
		src
	];

	execFile(require('../'), args, function (err) {
		if (err) {
			cb(err);
			return;
		}

		compareSize(src, dest, function (err, res) {
			if (err) {
				cb(err);
				return;
			}

			assert(res[dest] < res[src]);
			cb();
		});
	});
});
