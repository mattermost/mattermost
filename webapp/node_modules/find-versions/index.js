'use strict';
var semverRegex = require('semver-regex');
var arrayUniq = require('array-uniq');

module.exports = function (str, opts) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	opts = opts || {};

	var reLoose = new RegExp('(?:' + semverRegex().source + ')|(?:v?(?:\\d+\\.\\d+)(?:\\.\\d+)?)', 'g');
	var matches = str.match(opts.loose === true ? reLoose : semverRegex()) || [];

	return arrayUniq(matches.map(function (el) {
		return el.trim().replace(/^v/, '').replace(/^\d+\.\d+$/, '$&.0');
	}));
};
