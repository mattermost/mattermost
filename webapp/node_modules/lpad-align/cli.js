#!/usr/bin/env node
'use strict';
var path = require('path');
var getStdin = require('get-stdin');
var meow = require('meow');
var lpadAlign = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ cat <file> | lpad-align',
		'',
		'Example',
		'  $ cat unicorn.txt | lpad-align',
		'        foo',
		'     foobar',
		'  foobarcat'
	]
});

getStdin(function (data) {
	var indent = cli.flags.indent || 4;
	var arr = data.split(/\r?\n/);

	arr.forEach(function (el) {
		console.log(lpadAlign(el, arr, indent));
	});
});
