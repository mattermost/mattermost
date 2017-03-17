/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var ResolverFactory = require("./ResolverFactory");
var assign = require("object-assign");

var NodeJsInputFileSystem = require("./NodeJsInputFileSystem");
var SyncNodeJsInputFileSystem = require("./SyncNodeJsInputFileSystem");
var CachedInputFileSystem = require("./CachedInputFileSystem");

var asyncFileSystem = new CachedInputFileSystem(new NodeJsInputFileSystem(), 4000);
var syncFileSystem = new CachedInputFileSystem(new SyncNodeJsInputFileSystem(), 4000);

var nodeContext = {
	environments: [
		"node+es3+es5+process+native"
	]
};

var asyncResolver = ResolverFactory.createResolver({
	extensions: [".js", ".json", ".node"],
	fileSystem: asyncFileSystem
});
module.exports = function resolve(context, path, request, callback) {
	if(typeof context === "string") {
		callback = request;
		request = path;
		path = context;
		context = nodeContext;
	}
	asyncResolver.resolve(context, path, request, callback);
};

var syncResolver = ResolverFactory.createResolver({
	extensions: [".js", ".json", ".node"],
	fileSystem: syncFileSystem
});
module.exports.sync = function resolveSync(context, path, request) {
	if(typeof context === "string") {
		request = path;
		path = context;
		context = nodeContext;
	}
	return syncResolver.resolveSync(context, path, request);
};

var asyncContextResolver = ResolverFactory.createResolver({
	extensions: [".js", ".json", ".node"],
	resolveToContext: true,
	fileSystem: asyncFileSystem
});
module.exports.context = function resolveContext(context, path, request, callback) {
	if(typeof context === "string") {
		callback = request;
		request = path;
		path = context;
		context = nodeContext;
	}
	asyncContextResolver.resolve(context, path, request, callback);
};

var syncContextResolver = ResolverFactory.createResolver({
	extensions: [".js", ".json", ".node"],
	resolveToContext: true,
	fileSystem: syncFileSystem
});
module.exports.context.sync = function resolveContextSync(context, path, request) {
	if(typeof context === "string") {
		request = path;
		path = context;
		context = nodeContext;
	}
	return syncContextResolver.resolveSync(context, path, request);
};

var asyncLoaderResolver = ResolverFactory.createResolver({
	extensions: [".js", ".json", ".node"],
	moduleExtensions: ["-loader"],
	mainFields: ["loader", "main"],
	fileSystem: asyncFileSystem
});
module.exports.loader = function resolveLoader(context, path, request, callback) {
	if(typeof context === "string") {
		callback = request;
		request = path;
		path = context;
		context = nodeContext;
	}
	asyncLoaderResolver.resolve(context, path, request, callback);
};

var syncLoaderResolver = ResolverFactory.createResolver({
	extensions: [".js", ".json", ".node"],
	moduleExtensions: ["-loader"],
	mainFields: ["loader", "main"],
	fileSystem: syncFileSystem
});
module.exports.loader.sync = function resolveLoaderSync(context, path, request) {
	if(typeof context === "string") {
		request = path;
		path = context;
		context = nodeContext;
	}
	return syncLoaderResolver.resolveSync(context, path, request);
};

module.exports.create = function create(options) {
	options = assign({
		fileSystem: asyncFileSystem
	}, options);
	var resolver = ResolverFactory.createResolver(options);
	return function(context, path, request, callback) {
		if(typeof context === "string") {
			callback = request;
			request = path;
			path = context;
			context = nodeContext;
		}
		resolver.resolve(context, path, request, callback);
	};
};

module.exports.create.sync = function createSync(options) {
	options = assign({
		fileSystem: syncFileSystem
	}, options);
	var resolver = ResolverFactory.createResolver(options);
	return function(context, path, request) {
		if(typeof context === "string") {
			request = path;
			path = context;
			context = nodeContext;
		}
		return resolver.resolveSync(context, path, request);
	};
};

// Export Resolver, FileSystems and Plugins
module.exports.ResolverFactory = ResolverFactory;

module.exports.NodeJsInputFileSystem = NodeJsInputFileSystem;
module.exports.SyncNodeJsInputFileSystem = SyncNodeJsInputFileSystem;
module.exports.CachedInputFileSystem = CachedInputFileSystem;
