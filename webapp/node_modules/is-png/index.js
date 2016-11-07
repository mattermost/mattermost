'use strict';
module.exports = function (buf) {
	if (!buf || buf.length < 4) {
		return false;
	}

	return buf[0] === 137 &&
		buf[1] === 80 &&
		buf[2] === 78 &&
		buf[3] === 71;
};
