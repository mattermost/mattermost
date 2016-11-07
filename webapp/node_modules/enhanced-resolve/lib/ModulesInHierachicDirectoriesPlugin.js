/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var forEachBail = require("./forEachBail");
var getPaths = require("./getPaths");
var assign = require("object-assign");

function ModulesInHierachicDirectoriesPlugin(source, directories, target) {
	this.source = source;
	this.directories = [].concat(directories);
	this.target = target;
}
module.exports = ModulesInHierachicDirectoriesPlugin;

ModulesInHierachicDirectoriesPlugin.prototype.apply = function(resolver) {
	var directories = this.directories;
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var fs = this.fileSystem;
		var topLevelCallback = callback;
		var addrs = getPaths(request.path).paths.map(function(p) {
			return directories.map(function(d) {
				return this.join(p, d);
			}, this);
		}, this).reduce(function(array, p) {
			array.push.apply(array, p);
			return array;
		}, []);
		forEachBail(addrs, function(addr, callback) {
			fs.stat(addr, function(err, stat) {
				if(!err && stat && stat.isDirectory()) {
					var obj = assign({}, request, {
						path: addr,
						request: "./" + request.request
					});
					var message = "looking for modules in " + addr;
					return resolver.doResolve(target, obj, message, createInnerCallback(callback, topLevelCallback));
				}
				if(topLevelCallback.log) topLevelCallback.log(addr + " doesn't exist or is not a directory");
				if(topLevelCallback.missing) topLevelCallback.missing.push(addr);
				return callback();
			});
		}, callback);
	});
};
