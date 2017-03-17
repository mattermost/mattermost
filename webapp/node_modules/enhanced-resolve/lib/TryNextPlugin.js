/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

function TryNextPlugin(source, message, target) {
	this.source = source;
	this.message = message;
	this.target = target;
}
module.exports = TryNextPlugin;

TryNextPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var message = this.message;
	resolver.plugin(this.source, function(request, callback) {
		resolver.doResolve(target, request, message, callback);
	});
};
