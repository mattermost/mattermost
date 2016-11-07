'use strict';
var fs = require('fs')

module.exports = function (pth, cb) {
	var fn = typeof fs.access === 'function' ? fs.access : fs.stat;

	fn(pth, function (err) {
		cb(null, !err);
	});
};

module.exports.sync = function (pth) {
	var fn = typeof fs.accessSync === 'function' ? fs.accessSync : fs.statSync;

	try {
		fn(pth);
		return true;
	} catch (err) {
		return false;
	}
};
