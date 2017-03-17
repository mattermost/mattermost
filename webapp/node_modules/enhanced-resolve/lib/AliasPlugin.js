/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");
var createInnerCallback = require("./createInnerCallback");
var getInnerRequest = require("./getInnerRequest");

function AliasPlugin(source, options, target) {
	this.source = source;
	this.name = options.name;
	this.alias = options.alias;
	this.onlyModule = options.onlyModule;
	this.target = target;
}
module.exports = AliasPlugin;

AliasPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var name = this.name;
	var alias = this.alias;
	var onlyModule = this.onlyModule;
	resolver.plugin(this.source, function(request, callback) {
		var innerRequest = getInnerRequest(resolver, request);
		if(!innerRequest) return callback();
		if((!onlyModule && innerRequest.indexOf(name + "/") === 0) || innerRequest === name) {
			if(innerRequest.indexOf(alias + "/") !== 0 && innerRequest != alias) {
				var newRequestStr = alias + innerRequest.substr(name.length);
				var obj = assign({}, request, {
					request: newRequestStr
				});
				return resolver.doResolve(target, obj, "aliased with mapping '" + name + "': '" + alias + "' to '" + newRequestStr + "'", createInnerCallback(function(err, result) {
					if(arguments.length > 0) return callback(err, result);

					// don't allow other aliasing or raw request
					callback(null, null);
				}, callback));
			}
		}
		return callback();
	});
};
