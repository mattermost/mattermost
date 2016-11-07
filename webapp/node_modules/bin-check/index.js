'use strict';
var spawn = require('child_process').spawn;
var executable = require('executable');

module.exports = function (bin, cmd, cb) {
	if (typeof cmd === 'function') {
		cb = cmd;
		cmd = ['--help'];
	}

	executable(bin, function (err, works) {
		if (err) {
			cb(err);
			return;
		}

		if (!works) {
			cb(new Error('Couldn\'t execute the `' + bin + '` binary. Make sure it has the right permissions.'));
			return;
		}

		var cp = spawn(bin, cmd);

		cp.on('error', cb);
		cp.on('exit', function (code) {
			cb(null, code === 0);
		});
	});
};
