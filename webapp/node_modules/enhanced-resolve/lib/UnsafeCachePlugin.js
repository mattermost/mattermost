/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var assign = require("object-assign");

function UnsafeCachePlugin(source, filterPredicate, cache, target) {
	this.source = source;
	this.filterPredicate = filterPredicate;
	this.cache = cache || {};
	this.target = target;
}
module.exports = UnsafeCachePlugin;

function getCacheId(request) {
	return JSON.stringify({
		context: request.context,
		path: request.path,
		query: request.query,
		request: request.request
	});
}

UnsafeCachePlugin.prototype.apply = function(resolver) {
	var filterPredicate = this.filterPredicate;
	var cache = this.cache;
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		if(!filterPredicate(request)) return callback();
		var cacheId = getCacheId(request);
		var cacheEntry = cache[cacheId];
		if(cacheEntry) {
			return callback(null, cacheEntry);
		}
		resolver.doResolve(target, request, null, createInnerCallback(function(err, result) {
			if(err) return callback(err);
			if(result) return callback(null, cache[cacheId] = result);
			callback();
		}, callback));
	});
};
