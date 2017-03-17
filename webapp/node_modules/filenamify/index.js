'use strict';
var path = require('path');
var trimRepeated = require('trim-repeated');
var filenameReservedRegex = require('filename-reserved-regex');
var stripOuter = require('strip-outer');

// doesn't make sense to have longer filenames
var MAX_FILENAME_LENGTH = 100;

var reControlChars = /[\x00-\x1f\x80-\x9f]/g;
var reRelativePath = /^\.+/;

var fn = module.exports = function (str, opts) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	opts = opts || {};

	var replacement = opts.replacement || '!';

	if (filenameReservedRegex().test(replacement) && reControlChars.test(replacement)) {
		throw new Error('Replacement string cannot contain reserved filename characters');
	}

	str = str.replace(filenameReservedRegex(), replacement);
	str = str.replace(reControlChars, replacement);
	str = str.replace(reRelativePath, replacement);

	if (replacement.length > 0) {
		str = trimRepeated(str, replacement);
		str = str.length > 1 ? stripOuter(str, replacement) : str;
	}

	str = str.slice(0, MAX_FILENAME_LENGTH);

	return str;
};

fn.path = function (pth, opts) {
	pth = path.resolve(pth);
	return path.join(path.dirname(pth), fn(path.basename(pth), opts));
};
