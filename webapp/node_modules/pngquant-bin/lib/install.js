'use strict';
var BinBuild = require('bin-build');
var logalot = require('logalot');
var bin = require('./');

bin.run(['--version'], function (err) {
	if (err) {
		logalot.warn(err.message);
		logalot.warn('pngquant pre-build test failed');
		logalot.info('compiling from source');

		var libpng = process.platform === 'darwin' ? 'libpng' : 'libpng-dev';
		var builder = new BinBuild()
			.src('https://github.com/pornel/pngquant/archive/2.7.1.tar.gz')
			.cmd('rm ./INSTALL')
			.cmd('./configure --prefix="' + bin.dest() + '"')
			.cmd('make install BINPREFIX="' + bin.dest() + '"');

		return builder.run(function (err) {
			if (err) {
				err.message = [
					'pngquant failed to build, make sure that',
					libpng + ' is installed'
				].join(' ');

				logalot.error(err.stack);
				return;
			}

			logalot.success('pngquant built successfully');
		});
	}

	logalot.success('pngquant pre-build test passed successfully');
});
