/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

function AppendPlugin(source, appending, target) {
	this.source = source;
	this.appending = appending;
	this.target = target;
}
module.exports = AppendPlugin;

AppendPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var appending = this.appending;
	resolver.plugin(this.source, function(request, callback) {
		var obj = assign({}, request, {
			path: request.path + appending,
			relativePath: request.relativePath && (request.relativePath + appending)
		});
		resolver.doResolve(target, obj, appending, callback);
	});
};
