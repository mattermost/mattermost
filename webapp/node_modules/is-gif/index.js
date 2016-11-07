'use strict';
module.exports = function (buf) {
	if (!buf || buf.length < 3) {
		return false;
	}

	return buf[0] === 71 &&
		buf[1] === 73 &&
		buf[2] === 70;
};
