'use strict';
const execBuffer = require('exec-buffer');
const isPng = require('is-png');
const pngquant = require('pngquant-bin');

module.exports = opts => buf => {
	opts = Object.assign({}, opts);

	if (!Buffer.isBuffer(buf)) {
		return Promise.reject(new TypeError('Expected a buffer'));
	}

	if (!isPng(buf)) {
		return Promise.resolve(buf);
	}

	const args = [
		'--output', execBuffer.output,
		execBuffer.input
	];

	if (opts.floyd && typeof opts.floyd === 'number') {
		args.push(`--floyd=${opts.floyd}`);
	}

	if (opts.floyd && typeof opts.floyd === 'boolean') {
		args.push('--floyd');
	}

	if (opts.nofs) {
		args.push('--nofs');
	}

	if (opts.posterize) {
		args.push('--posterize', opts.posterize);
	}

	if (opts.quality) {
		args.push('--quality', opts.quality);
	}

	if (opts.speed) {
		args.push('--speed', opts.speed);
	}

	if (opts.verbose) {
		args.push('--verbose');
	}

	return execBuffer({
		input: buf,
		bin: pngquant,
		args
	}).catch(err => {
		err.message = err.stderr || err.message;
		throw err;
	});
};
