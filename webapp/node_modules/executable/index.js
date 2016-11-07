'use strict';

var fs = require('fs');

function isExe(mode, gid, uid) {
	if (process.platform === 'win32') {
		return true;
	}

	return (mode & parseInt('0001', 8)) ||
		(mode & parseInt('0010', 8)) && process.getgid && gid === process.getgid() ||
		(mode & parseInt('0100', 8)) && process.getuid && uid === process.getuid();
}

module.exports = function (name, cb) {
	if (typeof name !== 'string') {
		throw new Error('Filename required');
	}

	fs.stat(name, function (err, stats) {
		if (err) {
			cb(err);
			return;
		}

		if (stats && stats.isFile() && isExe(stats.mode, stats.gid, stats.uid)) {
			cb(null, true);
			return;
		}

		cb(null, false);
	});
};

module.exports.sync = function (name) {
	if (typeof name !== 'string') {
		throw new Error('Filename required');
	}

	var file = fs.statSync(name);

	if (file && file.isFile() && isExe(file.mode, file.gid, file.uid)) {
		return true;
	}

	return false;
};
