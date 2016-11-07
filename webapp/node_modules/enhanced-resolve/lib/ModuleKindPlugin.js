/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");
var createInnerCallback = require("./createInnerCallback");

function ModuleKindPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = ModuleKindPlugin;

ModuleKindPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		if(!request.module) return callback();
		var obj = assign({}, request);
		delete obj.module;
		resolver.doResolve(target, obj, "resolve as module", createInnerCallback(function(err, result) {
			if(arguments.length > 0) return callback(err, result);

			// Don't allow other alternatives
			callback(null, null);
		}, callback));
	});
};
