#!/usr/bin/env node
'use strict';

var meow = require('meow');
var executable = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ executable <file>',
		'',
		'Example',
		'  $ executable optipng'
	].join('\n')
});

if (!cli.input.length) {
	console.error('Filename required');
	process.exit(1);
}

executable(cli.input[0], function (err, exec) {
	if (err) {
		console.error(err.message);
		process.exit(1);
	}

	console.log(exec ? 'true' : 'false');
	process.exit(exec ? 0 : 1);
});
