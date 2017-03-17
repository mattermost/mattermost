'use strict';
var semver = require('semver');
var binVersion = require('bin-version');
var semverTruncate = require('semver-truncate');

module.exports = function (bin, versionRange, cb) {
	if (typeof bin !== 'string' || typeof versionRange !== 'string') {
		throw new Error('`binary` and `versionRange` required');
	}

	if (!semver.validRange(versionRange)) {
		return cb(new Error('Invalid version range'));
	}

	binVersion(bin, function (err, binVersion) {
		if (err) {
			return cb(err);
		}

		if (!semver.satisfies(semverTruncate(binVersion, 'patch'), versionRange)) {
			err = new Error(bin + ' ' + binVersion + ' does not satisfy the version requirement of ' + versionRange);
			err.name = 'InvalidBinVersion';
			return cb(err);
		}

		cb();
	});
};
