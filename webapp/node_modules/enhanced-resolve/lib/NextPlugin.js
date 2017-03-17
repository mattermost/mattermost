/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

function NextPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = NextPlugin;

NextPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		resolver.doResolve(target, request, null, callback);
	});
};
