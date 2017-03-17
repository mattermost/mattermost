'use strict';
module.exports = function (str, pad) {
	return pad ? String(str).split(/\r?\n/).map(function (line) {
		return line ? pad + line : line;
	}).join('\n') : str;
};
