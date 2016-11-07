/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var basename = require("./getPaths").basename;
var assign = require("object-assign");

function CloneBasenamePlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = CloneBasenamePlugin;

CloneBasenamePlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var fs = resolver.fileSystem;
		var topLevelCallback = callback;
		var filename = basename(request.path);
		var filePath = resolver.join(request.path, filename);
		var obj = assign({}, request, {
			path: filePath,
			relativePath: request.relativePath && resolver.join(request.relativePath, filename)
		});
		resolver.doResolve(target, obj, "using path: " + filePath, callback);
	});
};
