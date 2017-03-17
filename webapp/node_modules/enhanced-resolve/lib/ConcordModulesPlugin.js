/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");
var concord = require("./concord");
var DescriptionFileUtils = require("./DescriptionFileUtils");
var createInnerCallback = require("./createInnerCallback");
var getInnerRequest = require("./getInnerRequest");

function ConcordModulesPlugin(source, options, target) {
	this.source = source;
	this.options = options;
	this.target = target;
}
module.exports = ConcordModulesPlugin;

ConcordModulesPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var options = this.options;
	resolver.plugin(this.source, function(request, callback) {
		var innerRequest = getInnerRequest(resolver, request);
		if(!innerRequest) return callback();
		var concordField = DescriptionFileUtils.getField(request.descriptionFileData, "concord");
		if(!concordField) return callback();
		var data = concord.matchModule(request.context, concordField, innerRequest);
		if(data === innerRequest) return callback();
		if(data === undefined) return callback();
		if(data === false) {
			var ignoreObj = assign({}, request, {
				path: false
			});
			return callback(null, ignoreObj);
		}
		var obj = assign({}, request, {
			path: request.descriptionFileRoot,
			request: data
		});
		resolver.doResolve(target, obj, "aliased from description file " + request.descriptionFilePath + " with mapping '" + innerRequest + "' to '" + data + "'", createInnerCallback(function(err, result) {
			if(arguments.length > 0) return callback(err, result);

			// Don't allow other aliasing or raw request
			callback(null, null);
		}, callback));
	});
};
