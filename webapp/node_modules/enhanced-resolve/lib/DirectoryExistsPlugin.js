/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var assign = require("object-assign");

function DirectoryExistsPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = DirectoryExistsPlugin;

DirectoryExistsPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var fs = this.fileSystem;
		var directory = request.path;
		fs.stat(directory, function(err, stat) {
			if(err || !stat) {
				if(callback.missing) callback.missing.push(directory);
				if(callback.log) callback.log(directory + " doesn't exist");
				return callback();
			}
			if(!stat.isDirectory()) {
				if(callback.missing) callback.missing.push(directory);
				if(callback.log) callback.log(directory + " is not a directory");
				return callback();
			}
			this.doResolve(target, request, "existing directory", callback);
		}.bind(this));
	});
};
