#!/usr/bin/env node
'use strict';
var getStdin = require('get-stdin');
var meow = require('meow');
var findVersions = require('./');

var cli = meow([
	'Usage',
	'  $ find-versions <string> [--first] [--loose]',
	'  $ echo <string> | find-versions',
	'',
	'Example',
	'  $ find-versions \'unicorns v1.2.3\'',
	'  1.2.3',
	'',
	'  $ curl --version | find-versions --first',
	'  7.30.0',
	'',
	'Options',
	'  --first  Return the first match',
	'  --loose  Match non-semver versions like 1.88'
]);

function init(data) {
	var ret = findVersions(data, {loose: cli.flags.loose});
	console.log(cli.flags.first ? ret[0] : ret.join('\n'));
}

if (process.stdin.isTTY) {
	if (!cli.input[0]) {
		console.error('Expected a string');
		process.exit(1);
	}

	init(cli.input[0]);
} else {
	getStdin(init);
}
