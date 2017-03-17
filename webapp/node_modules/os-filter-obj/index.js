'use strict';

module.exports = function (arr) {
	var arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm' ? 'arm' : 'x86';
	var platform = process.platform;

	if (!arr || !arr.length) {
		return [];
	}

	return arr.filter(function (obj) {
		if (obj.os === platform && obj.arch === arch) {
			delete obj.os;
			delete obj.arch;
			return obj;
		} else if (obj.os === platform && !obj.arch) {
			delete obj.os;
			return obj;
		} else if (obj.arch === arch && !obj.os) {
			delete obj.arch;
			return obj;
		} else if (!obj.os && !obj.arch) {
			return obj;
		}
	});
};
