#!/usr/bin/env node
'use strict';
var spawn = require('child_process').spawn;
var pngquant = require('./');

var input = process.argv.slice(2);

spawn(pngquant, input, {stdio: 'inherit'})
	.on('exit', process.exit);
