'use strict';
const isSvg = require('is-svg');
const SVGO = require('svgo');

module.exports = opts => buf => {
	opts = Object.assign({multipass: true}, opts);

	if (!isSvg(buf)) {
		return Promise.resolve(buf);
	}

	if (Buffer.isBuffer(buf)) {
		buf = buf.toString();
	}

	const svgo = new SVGO(opts);

	return new Promise((resolve, reject) => {
		svgo.optimize(buf, res => {
			if (res.error) {
				reject(new Error(res.error));
				return;
			}

			resolve(new Buffer(res.data.replace(/&(?!amp;)/g, '&amp;')));
		});
	});
};
