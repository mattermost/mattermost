#!/usr/bin/env node
'use strict';
var argv = require('minimist')(process.argv.slice(2));
var pkg = require('./package.json');
var binVersionCheck = require('./');

function help() {
	console.log([
		'',
		'  ' + pkg.description,
		'',
		'  Usage',
		'    bin-version-check <binary> <semver-range>',
		'',
		'  Example',
		'    $ curl --version',
		'    curl 7.30.0 (x86_64-apple-darwin13.0)',
		'    $ bin-version-check curl \'>=8\'',
		'    curl 7.30.0 does not satisfy the version requirement of >=8',
		'',
		'  Exits with code 0 if the semver range is satisfied and 1 if not'
	].join('\n'));
}

if (argv._.length === 0 || argv.help) {
	help();
	return;
}

if (argv.version) {
	console.log(pkg.version);
	return;
}

binVersionCheck(argv._[0], argv._[1], function (err) {
	if (err) {
		console.error(err.message);
		process.exit(1);
	}
});
