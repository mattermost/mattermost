/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

function FileKindPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = FileKindPlugin;

FileKindPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		if(request.directory) return callback();
		var obj = assign({}, request);
		delete obj.directory;
		resolver.doResolve(target, obj, null, callback);
	});
};
