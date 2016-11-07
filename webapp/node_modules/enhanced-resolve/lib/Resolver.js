/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var Tapable = require("tapable");
var createInnerCallback = require("./createInnerCallback");

function Resolver(fileSystem) {
	Tapable.call(this);
	this.fileSystem = fileSystem;
}
module.exports = Resolver;

Resolver.prototype = Object.create(Tapable.prototype);

Resolver.prototype.constructor = Resolver;

Resolver.prototype.resolveSync = function resolveSync(context, path, request) {
	var err, result, sync = false;
	this.resolve(context, path, request, function(e, r) {
		err = e;
		result = r;
		sync = true;
	});
	if(!sync) throw new Error("Cannot 'resolveSync' because the fileSystem is not sync. Use 'resolve'!");
	if(err) throw err;
	return result;
};

Resolver.prototype.resolve = function resolve(context, path, request, callback) {
	if(arguments.length === 3) {
		throw new Error("Signature changed: context parameter added");
	}
	var resolver = this;
	var obj = {
		context: context,
		path: path,
		request: request
	};

	var localMissing = [];
	var missing = callback.missing ? {
		push: function(item) {
			callback.missing.push(item);
			localMissing.push(item);
		}
	} : localMissing;
	var log = [];
	var message = "resolve '" + request + "' in '" + path + "'";

	function writeLog(msg) {
		log.push(msg);
	}

	function logAsString() {
		return log.join("\n");
	}

	function onResolved(err, result) {
		if(callback.log) {
			for(var i = 0; i < log.length; i++)
				callback.log(log[i]);
		}
		if(err) return callback(err);
		if(!result) {
			var error = new Error("Can't " + message);
			error.details = logAsString();
			error.missing = localMissing;
			resolver.applyPlugins("no-resolve", obj, error);
			return callback(error);
		}
		return callback(null, result.path === false ? false : result.path + (result.query || ""), result);
	}
	return this.doResolve("resolve", obj, message, createInnerCallback(onResolved, {
		log: writeLog,
		missing: missing,
		stack: callback.stack
	}, null));
};

Resolver.prototype.doResolve = function doResolve(type, request, message, callback) {
	var resolver = this;
	var stackLine = type + ": (" + request.path + ") " +
		(request.request || "") + (request.query || "") +
		(request.directory ? " directory" : "") +
		(request.module ? " module" : "");
	var newStack = [stackLine];
	if(callback.stack) {
		newStack = callback.stack.concat(newStack);
		if(callback.stack.indexOf(stackLine) >= 0) {
			// Prevent recursion
			var recursionError = new Error("Recursion in resolving\nStack:\n  " + newStack.join("\n  "));
			recursionError.recursion = true;
			if(callback.log) callback.log("abort resolving because of recursion");
			return callback(recursionError);
		}
	}
	resolver.applyPlugins("resolve-step", type, request);

	resolver.applyPluginsAsyncSeriesBailResult1("before-" + type, request, createInnerCallback(beforeInnerCallback, {
		log: callback.log,
		missing: callback.missing,
		stack: newStack
	}, message && ("before " + message), true));

	function beforeInnerCallback(err, result) {
		if(arguments.length > 0) {
			if(err) return callback(err);
			if(result) return callback(null, result);
			return callback();
		}
		return resolver.applyPluginsParallelBailResult1(type, request, createInnerCallback(innerCallback, {
			log: callback.log,
			missing: callback.missing,
			stack: newStack
		}, message));
	}

	function innerCallback(err, result) {
		if(arguments.length > 0) {
			if(err) return callback(err);
			if(result) return callback(null, result);
			return callback();
		}
		return resolver.applyPluginsAsyncSeriesBailResult1("after-" + type, request, createInnerCallback(afterInnerCallback, {
			log: callback.log,
			missing: callback.missing,
			stack: newStack
		}, message && ("after " + message), true));
	}

	function afterInnerCallback(err, result) {
		if(arguments.length > 0) {
			if(err) return callback(err);
			if(result) return callback(null, result);
			return callback();
		}
		return callback();
	}
};

Resolver.prototype.parse = function parse(identifier) {
	if(identifier === "") return null;
	var part = {
		request: "",
		query: "",
		module: false,
		directory: false,
		file: false
	};
	var idxQuery = identifier.indexOf("?");
	if(idxQuery == 0) {
		part.query = identifier;
	} else if(idxQuery > 0) {
		part.request = identifier.slice(0, idxQuery);
		part.query = identifier.slice(idxQuery);
	} else {
		part.request = identifier;
	}
	if(part.request) {
		part.module = this.isModule(part.request);
		if(part.directory = this.isDirectory(part.request)) {
			part.request = part.request.substr(0, part.request.length - 1);
		}
	}
	return part;
};

var notModuleRegExp = /^\.$|^\.[\\\/]|^\.\.$|^\.\.[\/\\]|^\/|^[A-Z]:[\\\/]/i;
Resolver.prototype.isModule = function isModule(path) {
	return !notModuleRegExp.test(path);
};

var directoryRegExp = /[\/\\]$/i;
Resolver.prototype.isDirectory = function isDirectory(path) {
	return directoryRegExp.test(path);
};

var memoryFsJoin = require("memory-fs/lib/join");
var memoizedJoin = {};
Resolver.prototype.join = function(path, request) {
	var memoizeKey = path + '|$' + request;
	if(!memoizedJoin[memoizeKey]) {
		memoizedJoin[memoizeKey] = memoryFsJoin(path, request);
	}
	return memoizedJoin[memoizeKey];
};

Resolver.prototype.normalize = require("memory-fs/lib/normalize");
