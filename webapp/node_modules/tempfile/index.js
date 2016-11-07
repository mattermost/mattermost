'use strict';
var path = require('path');
var osTmpdir = require('os-tmpdir');
var uuid = require('uuid');
var TMP_DIR = osTmpdir();

module.exports = function (ext) {
	return path.join(TMP_DIR, uuid.v4() + (ext || ''));
};
