/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");
var concord = require("./concord");
var DescriptionFileUtils = require("./DescriptionFileUtils");
var forEachBail = require("./forEachBail");
var createInnerCallback = require("./createInnerCallback");

function ConcordExtensionsPlugin(source, options, target) {
	this.source = source;
	this.options = options;
	this.target = target;
}
module.exports = ConcordExtensionsPlugin;

ConcordExtensionsPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var concordField = DescriptionFileUtils.getField(request.descriptionFileData, "concord");
		if(!concordField) return callback();
		var extensions = concord.getExtensions(request.context, concordField);
		if(!extensions) return callback();
		var topLevelCallback = callback;
		forEachBail(extensions, function(appending, callback) {
			var obj = assign({}, request, {
				path: request.path + appending,
				relativePath: request.relativePath && (request.relativePath + appending)
			});
			resolver.doResolve(target, obj, "concord extension: " + appending, createInnerCallback(callback, topLevelCallback));
		}, function(err, result) {
			if(arguments.length > 0) return callback(err, result);

			callback(null, null);
		});
	});
};
