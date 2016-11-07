'use strict';
var htmlCommentRegex = require('html-comment-regex');

function isBinary(buf) {
	var isBuf = Buffer.isBuffer(buf);

	for (var i = 0; i < 24; i++) {
		var charCode = isBuf ? buf[i] : buf.charCodeAt(i);

		if (charCode === 65533 || charCode <= 8) {
			return true;
		}
	}

	return false;
}

module.exports = function (buf) {
	return !isBinary(buf) && /^\s*(?:<\?xml[^>]*>\s*)?(?:<!doctype svg[^>]*\s*(?:<![^>]*>)*[^>]*>\s*)?<svg[^>]*>[^]*<\/svg>\s*$/i.test(buf.toString().replace(htmlCommentRegex, ''));
};
