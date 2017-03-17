/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var path = require("path");
var assign = require("object-assign");
var concord = require("./concord");
var DescriptionFileUtils = require("./DescriptionFileUtils");

function ConcordMainPlugin(source, options, target) {
	this.source = source;
	this.options = options;
	this.target = target;
}
module.exports = ConcordMainPlugin;

ConcordMainPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var options = this.options;
	resolver.plugin(this.source, function(request, callback) {
		if(request.path !== request.descriptionFileRoot) return callback();
		var concordField = DescriptionFileUtils.getField(request.descriptionFileData, "concord");
		if(!concordField) return callback();
		var mainModule = concord.getMain(request.context, concordField);
		if(!mainModule) return callback();
		var obj = assign({}, request, {
			request: mainModule
		});
		var filename = path.basename(request.descriptionFilePath);
		return resolver.doResolve(target, obj, "use " + mainModule + " from " + filename, callback);
	});
};
