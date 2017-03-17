'use strict';

var path = require('path');
var isglob = require('is-glob');
var pathDirname = require('path-dirname');

module.exports = function globParent(str) {
	str += 'a'; // preserves full path in case of trailing path separator
	do {str = pathDirname.posix(str)} while (isglob(str));
	return str.replace(/\\([\*\?\|\[\]\(\)\{\}])/g, '$1');
};
