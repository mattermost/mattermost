'use strict';
var longest = require('longest');
var lpad = require('lpad');

module.exports = function (str, arr, indent) {
	if (!Array.isArray(arr)) {
		throw new Error('`arr` is required');
	}

	var len = longest(arr).length;
	return lpad(str, new Array((indent || 0) + 1 + len - str.length).join(' '));
};
