'use strict';
var url = require('url');
var getProxy = require('get-proxy');
var objectAssign = require('object-assign');
var tunnelAgent = require('tunnel-agent');
var isObj = require('is-obj');

module.exports = function (proxy, opts) {
	opts = objectAssign({}, opts);

	if (isObj(proxy)) {
		opts = proxy;
		proxy = getProxy();
	} else if (proxy === undefined) {
		proxy = getProxy();
	}

	if (!proxy) {
		return undefined;
	}

	proxy = url.parse(proxy);

	var uriProtocol = opts.protocol === 'https' ? 'https' : 'http';
	var proxyProtocol = proxy.protocol === 'https:' ? 'Https' : 'Http';
	var port = proxy.port || (proxyProtocol === 'Https' ? 443 : 80);
	var method = [uriProtocol, proxyProtocol].join('Over');

	delete opts.protocol;

	return tunnelAgent[method](objectAssign({
		proxy: {
			host: proxy.hostname,
			port: port,
			proxyAuth: proxy.auth
		}
	}, opts));
};
