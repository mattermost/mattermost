/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var path = require("path");
var loaderUtils = require("loader-utils");
var processCss = require("./processCss");
var getImportPrefix = require("./getImportPrefix");
var compileExports = require("./compile-exports");


module.exports = function(content, map) {
	if(this.cacheable) this.cacheable();
	var callback = this.async();
	var query = loaderUtils.parseQuery(this.query);
	var root = query.root;
	var moduleMode = query.modules || query.module;
	var camelCaseKeys = query.camelCase || query.camelcase;

	if(map !== null && typeof map !== "string") {
		map = JSON.stringify(map);
	}

	processCss(content, map, {
		mode: moduleMode ? "local" : "global",
		from: loaderUtils.getRemainingRequest(this),
		to: loaderUtils.getCurrentRequest(this),
		query: query,
		minimize: this.minimize,
		loaderContext: this
	}, function(err, result) {
		if(err) return callback(err);

		var cssAsString = JSON.stringify(result.source);

		// for importing CSS
		var importUrlPrefix = getImportPrefix(this, query);

		var alreadyImported = {};
		var importJs = result.importItems.filter(function(imp) {
			if(!imp.mediaQuery) {
				if(alreadyImported[imp.url])
					return false;
				alreadyImported[imp.url] = true;
			}
			return true;
		}).map(function(imp) {
			if(!loaderUtils.isUrlRequest(imp.url, root)) {
				return "exports.push([module.id, " +
					JSON.stringify("@import url(" + imp.url + ");") + ", " +
					JSON.stringify(imp.mediaQuery) + "]);";
			} else {
				var importUrl = importUrlPrefix + imp.url;
				return "exports.i(require(" + loaderUtils.stringifyRequest(this, importUrl) + "), " + JSON.stringify(imp.mediaQuery) + ");";
			}
		}, this).join("\n");

		function importItemMatcher(item) {
			var match = result.importItemRegExp.exec(item);
			var idx = +match[1];
			var importItem = result.importItems[idx];
			var importUrl = importUrlPrefix + importItem.url;
			return "\" + require(" + loaderUtils.stringifyRequest(this, importUrl) + ").locals" +
				"[" + JSON.stringify(importItem.export) + "] + \"";
		}

		cssAsString = cssAsString.replace(result.importItemRegExpG, importItemMatcher.bind(this));
		if(query.url !== false) {
			cssAsString = cssAsString.replace(result.urlItemRegExpG, function(item) {
				var match = result.urlItemRegExp.exec(item);
				var idx = +match[1];
				var urlItem = result.urlItems[idx];
				var url = urlItem.url;
				idx = url.indexOf("?#");
				if(idx < 0) idx = url.indexOf("#");
				var urlRequest;
				if(idx > 0) { // idx === 0 is catched by isUrlRequest
					// in cases like url('webfont.eot?#iefix')
					urlRequest = url.substr(0, idx);
					return "\" + require(" + loaderUtils.stringifyRequest(this, urlRequest) + ") + \"" +
							url.substr(idx);
				}
				urlRequest = url;
				return "\" + require(" + loaderUtils.stringifyRequest(this, urlRequest) + ") + \"";
			}.bind(this));
		}


		var exportJs = compileExports(result, importItemMatcher.bind(this), camelCaseKeys);
		if (exportJs) {
			exportJs = "exports.locals = " + exportJs + ";";
		}

		var moduleJs;
		if(query.sourceMap && result.map) {
			// add a SourceMap
			map = result.map;
			if(map.sources) {
				map.sources = map.sources.map(function(source) {
					source = source.split("!").pop();
					var p = path.relative(query.context || this.options.context, source).replace(/\\/g, "/");
					if(p.indexOf("../") !== 0)
						p = "./" + p;
					return "/" + p;
				}, this);
				map.sourceRoot = "webpack://";
			}
			map.file = map.file.split("!").pop();
			map = JSON.stringify(map);
			moduleJs = "exports.push([module.id, " + cssAsString + ", \"\", " + map + "]);";
		} else {
			moduleJs = "exports.push([module.id, " + cssAsString + ", \"\"]);";
		}

		// embed runtime
		callback(null, "exports = module.exports = require(" + loaderUtils.stringifyRequest(this, require.resolve("./css-base.js")) + ")();\n" +
			"// imports\n" +
			importJs + "\n\n" +
			"// module\n" +
			moduleJs + "\n\n" +
			"// exports\n" +
			exportJs);
	}.bind(this));
};
