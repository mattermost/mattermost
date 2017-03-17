#!/usr/bin/env node
'use strict';
var spawn = require('child_process').spawn;
var gifsicle = require('./');

var input = process.argv.slice(2);

spawn(gifsicle, input, {stdio: 'inherit'})
	.on('exit', process.exit);
