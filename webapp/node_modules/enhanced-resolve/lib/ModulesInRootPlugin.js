/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var assign = require("object-assign");

function ModulesInRootPlugin(source, path, target) {
	this.source = source;
	this.path = path;
	this.target = target;
}
module.exports = ModulesInRootPlugin;

ModulesInRootPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var path = this.path;
	resolver.plugin(this.source, function(request, callback) {
		var obj = assign({}, request, {
			path: path,
			request: "./" + request.request
		});
		resolver.doResolve(target, obj, "looking for modules in " + path, callback, true);
	});
};
