/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var assign = require("object-assign");

function FileExistsPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = FileExistsPlugin;

FileExistsPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var fs = this.fileSystem;
		var file = request.path;
		fs.stat(file, function(err, stat) {
			if(err || !stat) {
				if(callback.missing) callback.missing.push(file);
				if(callback.log) callback.log(file + " doesn't exist");
				return callback();
			}
			if(!stat.isFile()) {
				if(callback.missing) callback.missing.push(file);
				if(callback.log) callback.log(file + " is not a file");
				return callback();
			}
			this.doResolve(target, request, "existing file: " + file, callback, true);
		}.bind(this));
	});
};
