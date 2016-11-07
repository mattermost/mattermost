#!/usr/bin/env node
'use strict';

var spawn = require('child_process').spawn;
var optipng = require('./');
var input = process.argv.slice(2);

spawn(optipng, input, {stdio: 'inherit'})
	.on('exit', process.exit);
