/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");
var DescriptionFileUtils = require("./DescriptionFileUtils");
var createInnerCallback = require("./createInnerCallback");
var getInnerRequest = require("./getInnerRequest");

function AliasFieldPlugin(source, field, target) {
	this.source = source;
	this.field = field;
	this.target = target;
}
module.exports = AliasFieldPlugin;

AliasFieldPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var field = this.field;
	resolver.plugin(this.source, function(request, callback) {
		if(!request.descriptionFileData) return callback();
		var innerRequest = getInnerRequest(resolver, request);
		if(!innerRequest) return callback();
		var fieldData = DescriptionFileUtils.getField(request.descriptionFileData, field);
		if(typeof fieldData !== "object") {
			if(callback.log) callback.log("Field '" + field + "' doesn't contain a valid alias configuration");
			return callback();
		}
		var data1 = fieldData[innerRequest];
		var data2 = fieldData[innerRequest.replace(/^\.\//, "")];
		var data = typeof data1 !== "undefined" ? data1 : data2;
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
