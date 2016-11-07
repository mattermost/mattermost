/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

function ParsePlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = ParsePlugin;

ParsePlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var parsed = resolver.parse(request.request);
		var obj = assign({}, request, parsed);
		if(request.query && !parsed.query) {
			obj.query = request.query;
		}
		if(callback.log) {
			if(parsed.module)
				callback.log("Parsed request is a module");
			if(parsed.directory)
				callback.log("Parsed request is a directory");
		}
		resolver.doResolve(target, obj, null, callback);
	});
};
