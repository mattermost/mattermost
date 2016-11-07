'use strict';
var path = require('path');
var BinBuild = require('bin-build');
var log = require('logalot');
var bin = require('./');

var args = [
	'-copy', 'none',
	'-optimize',
	'-outfile', path.join(__dirname, '../test/fixtures/test-optimized.jpg'),
	path.join(__dirname, '../test/fixtures/test.jpg')
];

bin.run(args, function (err) {
	if (err) {
		log.warn(err.message);
		log.warn('jpegtran pre-build test failed');
		log.info('compiling from source');

		var cfg = [
			'./configure --disable-shared',
			'--prefix="' + bin.dest() + '" --bindir="' + bin.dest() + '"'
		].join(' ');

		var builder = new BinBuild()
			.cmd('touch configure.ac aclocal.m4 configure Makefile.am Makefile.in')
			.src('https://downloads.sourceforge.net/project/libjpeg-turbo/1.5.0/libjpeg-turbo-1.5.0.tar.gz')
			.cmd(cfg)
			.cmd('make install');

		return builder.run(function (err) {
			if (err) {
				log.error(err.stack);
				return;
			}

			log.success('jpegtran built successfully');
		});
	}

	log.success('jpegtran pre-build test passed successfully');
});
