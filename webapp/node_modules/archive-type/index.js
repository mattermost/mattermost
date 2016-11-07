'use strict';
var fileType = require('file-type');

module.exports = function (buf) {
	var ret = fileType(buf);
	var exts = [
		'7z',
		'bz2',
		'gz',
		'rar',
		'tar',
		'zip',
		'xz',
		'gz'
	];

	return exts.indexOf(ret && ret.ext) !== -1 ? ret : null;
};
