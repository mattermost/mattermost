'use strict';

var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var urlLib = require('url');
var querystring = require('querystring');
var objectAssign = require('object-assign');
var PassThrough = require('readable-stream').PassThrough;
var duplexer2 = require('duplexer2');
var isStream = require('is-stream');
var readAllStream = require('read-all-stream');
var timedOut = require('timed-out');
var urlParseLax = require('url-parse-lax');
var lowercaseKeys = require('lowercase-keys');
var isRedirect = require('is-redirect');
var PinkiePromise = require('pinkie-promise');
var unzipResponse = require('unzip-response');
var createErrorClass = require('create-error-class');
var nodeStatusCodes = require('node-status-codes');
var parseJson = require('parse-json');
var isRetryAllowed = require('is-retry-allowed');
var pkg = require('./package.json');

function requestAsEventEmitter(opts) {
	opts = opts || {};

	var ee = new EventEmitter();
	var requestUrl = opts.href || urlLib.resolve(urlLib.format(opts), opts.path);
	var redirectCount = 0;
	var retryCount = 0;
	var redirectUrl;

	var get = function (opts) {
		var fn = opts.protocol === 'https:' ? https : http;

		var req = fn.request(opts, function (res) {
			var statusCode = res.statusCode;

			if (isRedirect(statusCode) && opts.followRedirect && 'location' in res.headers && (opts.method === 'GET' || opts.method === 'HEAD')) {
				res.resume();

				if (++redirectCount > 10) {
					ee.emit('error', new got.MaxRedirectsError(statusCode, opts), null, res);
					return;
				}

				redirectUrl = urlLib.resolve(urlLib.format(opts), res.headers.location);
				var redirectOpts = objectAssign({}, opts, urlLib.parse(redirectUrl));

				ee.emit('redirect', res, redirectOpts);

				get(redirectOpts);
				return;
			}

			// do not write ee.bind(...) instead of function - it will break gzip in Node.js 0.10
			setImmediate(function () {
				var response = typeof unzipResponse === 'function' && req.method !== 'HEAD' ? unzipResponse(res) : res;
				response.url = redirectUrl || requestUrl;
				response.requestUrl = requestUrl;

				ee.emit('response', response);
			});
		});

		req.once('error', function (err) {
			var backoff = opts.retries(++retryCount, err);
			if (backoff) {
				setTimeout(get, backoff, opts);
				return;
			}

			ee.emit('error', new got.RequestError(err, opts));
		});

		if (opts.timeout) {
			timedOut(req, opts.timeout);
		}

		setImmediate(ee.emit.bind(ee), 'request', req);
	};

	get(opts);
	return ee;
}

function asCallback(opts, cb) {
	var ee = requestAsEventEmitter(opts);

	ee.on('request', function (req) {
		if (isStream(opts.body)) {
			opts.body.pipe(req);
			opts.body = undefined;
			return;
		}

		req.end(opts.body);
	});

	ee.on('response', function (res) {
		readAllStream(res, opts.encoding, function (error, data) {
			var statusCode = res.statusCode;
			var limitStatusCode = opts.followRedirect ? 299 : 399;

			if (error) {
				cb(new got.ReadError(error, opts), null, res);
				return;
			}

			if (statusCode < 200 || statusCode > limitStatusCode) {
				error = new got.HTTPError(statusCode, opts);
			}

			if (opts.json && data) {
				try {
					data = parseJson(data);
				} catch (err) {
					err.fileName = urlLib.format(opts);
					error = new got.ParseError(err, statusCode, opts);
				}
			}

			cb(error, data, res);
		});
	});

	ee.on('error', cb);
}

function asPromise(opts) {
	return new PinkiePromise(function (resolve, reject) {
		asCallback(opts, function (err, data, response) {
			if (response) {
				response.body = data;
			}

			if (err) {
				Object.defineProperty(err, 'response', {
					value: response,
					enumerable: false
				});
				reject(err);
				return;
			}

			resolve(response);
		});
	});
}

function asStream(opts) {
	var input = new PassThrough();
	var output = new PassThrough();
	var proxy = duplexer2(input, output);

	if (opts.json) {
		throw new Error('got can not be used as stream when options.json is used');
	}

	if (opts.body) {
		proxy.write = function () {
			throw new Error('got\'s stream is not writable when options.body is used');
		};
	}

	var ee = requestAsEventEmitter(opts);

	ee.on('request', function (req) {
		proxy.emit('request', req);

		if (isStream(opts.body)) {
			opts.body.pipe(req);
			return;
		}

		if (opts.body) {
			req.end(opts.body);
			return;
		}

		if (opts.method === 'POST' || opts.method === 'PUT' || opts.method === 'PATCH') {
			input.pipe(req);
			return;
		}

		req.end();
	});

	ee.on('response', function (res) {
		var statusCode = res.statusCode;
		var limitStatusCode = opts.followRedirect ? 299 : 399;

		res.pipe(output);

		if (statusCode < 200 || statusCode > limitStatusCode) {
			proxy.emit('error', new got.HTTPError(statusCode, opts), null, res);
			return;
		}

		proxy.emit('response', res);
	});

	ee.on('redirect', proxy.emit.bind(proxy, 'redirect'));

	ee.on('error', proxy.emit.bind(proxy, 'error'));

	return proxy;
}

function normalizeArguments(url, opts) {
	if (typeof url !== 'string' && typeof url !== 'object') {
		throw new Error('Parameter `url` must be a string or object, not ' + typeof url);
	}

	if (typeof url === 'string') {
		url = url.replace(/^unix:/, 'http://$&');
		url = urlParseLax(url);

		if (url.auth) {
			throw new Error('Basic authentication must be done with auth option');
		}
	}

	opts = objectAssign(
		{protocol: 'http:', path: '', retries: 5},
		url,
		opts
	);

	opts.headers = objectAssign({
		'user-agent': pkg.name + '/' + pkg.version + ' (https://github.com/sindresorhus/got)',
		'accept-encoding': 'gzip,deflate'
	}, lowercaseKeys(opts.headers));

	var query = opts.query;

	if (query) {
		if (typeof query !== 'string') {
			opts.query = querystring.stringify(query);
		}

		opts.path = opts.path.split('?')[0] + '?' + opts.query;
		delete opts.query;
	}

	if (opts.json && opts.headers.accept === undefined) {
		opts.headers.accept = 'application/json';
	}

	var body = opts.body;

	if (body) {
		if (typeof body !== 'string' && !(body !== null && typeof body === 'object')) {
			throw new Error('options.body must be a ReadableStream, string, Buffer or plain Object');
		}

		opts.method = opts.method || 'POST';

		if (isStream(body) && typeof body.getBoundary === 'function') {
			// Special case for https://github.com/form-data/form-data
			opts.headers['content-type'] = opts.headers['content-type'] || 'multipart/form-data; boundary=' + body.getBoundary();
		} else if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body) && !isStream(body)) {
			opts.headers['content-type'] = opts.headers['content-type'] || 'application/x-www-form-urlencoded';
			body = opts.body = querystring.stringify(body);
		}

		if (opts.headers['content-length'] === undefined && opts.headers['transfer-encoding'] === undefined && !isStream(body)) {
			var length = typeof body === 'string' ? Buffer.byteLength(body) : body.length;
			opts.headers['content-length'] = length;
		}
	}

	opts.method = opts.method || 'GET';

	opts.method = opts.method.toUpperCase();

	if (opts.hostname === 'unix') {
		var matches = /(.+):(.+)/.exec(opts.path);

		if (matches) {
			opts.socketPath = matches[1];
			opts.path = matches[2];
			opts.host = null;
		}
	}

	if (typeof opts.retries !== 'function') {
		var retries = opts.retries;
		opts.retries = function backoff(iter, err) {
			if (iter > retries || !isRetryAllowed(err)) {
				return 0;
			}

			var noise = Math.random() * 100;
			return ((1 << iter) * 1000) + noise;
		};
	}

	if (opts.followRedirect === undefined) {
		opts.followRedirect = true;
	}

	return opts;
}

function got(url, opts, cb) {
	if (typeof opts === 'function') {
		cb = opts;
		opts = {};
	}

	if (cb) {
		asCallback(normalizeArguments(url, opts), cb);
		return null;
	}

	try {
		return asPromise(normalizeArguments(url, opts));
	} catch (err) {
		return PinkiePromise.reject(err);
	}
}

var helpers = [
	'get',
	'post',
	'put',
	'patch',
	'head',
	'delete'
];

helpers.forEach(function (el) {
	got[el] = function (url, opts, cb) {
		if (typeof opts === 'function') {
			cb = opts;
			opts = {};
		}

		return got(url, objectAssign({}, opts, {method: el}), cb);
	};
});

got.stream = function (url, opts, cb) {
	if (cb || typeof opts === 'function') {
		throw new Error('callback can not be used with stream mode');
	}

	return asStream(normalizeArguments(url, opts));
};

helpers.forEach(function (el) {
	got.stream[el] = function (url, opts, cb) {
		if (typeof opts === 'function') {
			cb = opts;
			opts = {};
		}

		return got.stream(url, objectAssign({}, opts, {method: el}), cb);
	};
});

function stdError(error, opts) {
	if (error.code !== undefined) {
		this.code = error.code;
	}

	objectAssign(this, {
		message: error.message,
		host: opts.host,
		hostname: opts.hostname,
		method: opts.method,
		path: opts.path
	});
}

got.RequestError = createErrorClass('RequestError', stdError);
got.ReadError = createErrorClass('ReadError', stdError);

got.ParseError = createErrorClass('ParseError', function (e, statusCode, opts) {
	stdError.call(this, e, opts);
	this.statusCode = statusCode;
	this.statusMessage = nodeStatusCodes[this.statusCode];
});

got.HTTPError = createErrorClass('HTTPError', function (statusCode, opts) {
	stdError.call(this, {}, opts);
	this.statusCode = statusCode;
	this.statusMessage = nodeStatusCodes[this.statusCode];
	this.message = 'Response code ' + this.statusCode + ' (' + this.statusMessage + ')';
});

got.MaxRedirectsError = createErrorClass('MaxRedirectsError', function (statusCode, opts) {
	stdError.call(this, {}, opts);
	this.statusCode = statusCode;
	this.statusMessage = nodeStatusCodes[this.statusCode];
	this.message = 'Redirected 10 times. Aborting.';
});

module.exports = got;
