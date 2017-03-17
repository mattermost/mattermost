/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var loaderUtils = require("loader-utils"),
	path = require("path");
module.exports = function() {};
module.exports.pitch = function(remainingRequest) {
	if(this.cacheable) this.cacheable();
	var query = loaderUtils.parseQuery(this.query);
	return [
		"var refs = 0;",
		"var dispose;",
		"var content = require(" + loaderUtils.stringifyRequest(this, "!!" + remainingRequest) + ");",
		"if(typeof content === 'string') content = [[module.id, content, '']];",
		"exports.use = exports.ref = function() {",
		"	if(!(refs++)) {",
		"		exports.locals = content.locals;",
		"		dispose = require(" + loaderUtils.stringifyRequest(this, "!" + path.join(__dirname, "addStyles.js")) + ")(content, " + JSON.stringify(query) + ");",
		"	}",
		"	return exports;",
		"};",
		"exports.unuse = exports.unref = function() {",
		"	if(!(--refs)) {",
		"		dispose();",
		"		dispose = null;",
		"	}",
		"};",
		"if(module.hot) {",
		"	var lastRefs = module.hot.data && module.hot.data.refs || 0;",
		"	if(lastRefs) {",
		"		exports.ref();",
		"		if(!content.locals) {",
		"			refs = lastRefs;",
		"		}",
		"	}",
		"	if(!content.locals) {",
		"		module.hot.accept();",
		"	}",
		"	module.hot.dispose(function(data) {",
		"		data.refs = content.locals ? 0 : refs;",
		"		if(dispose) {",
		"			dispose();",
		"		}",
		"	});",
		"}"
	].join("\n");
};
