/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var path = require("path");
var assign = require("object-assign");

function MainFieldPlugin(source, options, target) {
	this.source = source;
	this.options = options;
	this.target = target;
}
module.exports = MainFieldPlugin;

MainFieldPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var options = this.options;
	resolver.plugin(this.source, function mainField(request, callback) {
		if(request.path !== request.descriptionFileRoot) return callback();
		var content = request.descriptionFileData;
		var filename = path.basename(request.descriptionFilePath);
		var mainModule;
		var field = options.name;
		if(Array.isArray(field)) {
			var current = content;
			for(var j = 0; j < field.length; j++) {
				if(current === null || typeof current !== "object") {
					current = null;
					break;
				}
				current = current[field[j]];
			}
			if(typeof current === "string") {
				mainModule = current;
			}
		} else {
			if(typeof content[field] === "string") {
				mainModule = content[field];
			}
		}
		if(!mainModule) return callback();
		if(options.forceRelative && !/^\.\.?\//.test(mainModule))
			mainModule = "./" + mainModule;
		var obj = assign({}, request, {
			request: mainModule
		});
		return resolver.doResolve(target, obj, "use " + mainModule + " from " + options.name + " in " + filename, callback);
	});
};
