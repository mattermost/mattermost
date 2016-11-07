/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

function JoinRequestPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = JoinRequestPlugin;

JoinRequestPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var obj = assign({}, request, {
			path: resolver.join(request.path, request.request),
			relativePath: request.relativePath && resolver.join(request.relativePath, request.request),
			request: undefined
		});
		resolver.doResolve(target, obj, null, callback);
	});
};
