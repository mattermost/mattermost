/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var ConcatSource = require("webpack-sources").ConcatSource;
var async = require("async");
var ExtractedModule = require("./ExtractedModule");
var Chunk = require("webpack/lib/Chunk");
var OrderUndefinedError = require("./OrderUndefinedError");
var loaderUtils = require("loader-utils");

var nextId = 0;

function ExtractTextPluginCompilation() {
	this.modulesByIdentifier = {};
}

ExtractTextPlugin.prototype.mergeNonInitialChunks = function(chunk, intoChunk, checkedChunks) {
	if(!intoChunk) {
		checkedChunks = [];
		chunk.chunks.forEach(function(c) {
			if(c.initial) return;
			this.mergeNonInitialChunks(c, chunk, checkedChunks);
		}, this);
	} else if(checkedChunks.indexOf(chunk) < 0) {
		checkedChunks.push(chunk);
		chunk.modules.slice().forEach(function(module) {
			intoChunk.addModule(module);
			module.addChunk(intoChunk);
		});
		chunk.chunks.forEach(function(c) {
			if(c.initial) return;
			this.mergeNonInitialChunks(c, intoChunk, checkedChunks);
		}, this);
	}
};

ExtractTextPluginCompilation.prototype.addModule = function(identifier, originalModule, source, additionalInformation, sourceMap, prevModules) {
	var m;
	if(!this.modulesByIdentifier[identifier]) {
		m = this.modulesByIdentifier[identifier] = new ExtractedModule(identifier, originalModule, source, sourceMap, additionalInformation, prevModules);
	} else {
		m = this.modulesByIdentifier[identifier];
		m.addPrevModules(prevModules);
		if(originalModule.index2 < m.getOriginalModule().index2) {
			m.setOriginalModule(originalModule);
		}
	}
	return m;
};

ExtractTextPluginCompilation.prototype.addResultToChunk = function(identifier, result, originalModule, extractedChunk) {
	if(!Array.isArray(result)) {
		result = [[identifier, result]];
	}
	var counterMap = {};
	var prevModules = [];
	result.forEach(function(item) {
		var c = counterMap[item[0]];
		var module = this.addModule.call(this, item[0] + (c || ""), originalModule, item[1], item[2], item[3], prevModules.slice());
		extractedChunk.addModule(module);
		module.addChunk(extractedChunk);
		counterMap[item[0]] = (c || 0) + 1;
		prevModules.push(module);
	}, this);
};

ExtractTextPlugin.prototype.renderExtractedChunk = function(chunk) {
	var source = new ConcatSource();
	chunk.modules.forEach(function(module) {
		var moduleSource = module.source();
		source.add(this.applyAdditionalInformation(moduleSource, module.additionalInformation));
	}, this);
	return source;
};

function isInvalidOrder(a, b) {
	var bBeforeA = a.getPrevModules().indexOf(b) >= 0;
	var aBeforeB = b.getPrevModules().indexOf(a) >= 0;
	return aBeforeB && bBeforeA;
}

function getOrder(a, b) {
	var aOrder = a.getOrder();
	var bOrder = b.getOrder();
	if(aOrder < bOrder) return -1;
	if(aOrder > bOrder) return 1;
	var aIndex = a.getOriginalModule().index2;
	var bIndex = b.getOriginalModule().index2;
	if(aIndex < bIndex) return -1;
	if(aIndex > bIndex) return 1;
	var bBeforeA = a.getPrevModules().indexOf(b) >= 0;
	var aBeforeB = b.getPrevModules().indexOf(a) >= 0;
	if(aBeforeB && !bBeforeA) return -1;
	if(!aBeforeB && bBeforeA) return 1;
	var ai = a.identifier();
	var bi = b.identifier();
	if(ai < bi) return -1;
	if(ai > bi) return 1;
	return 0;
}

function ExtractTextPlugin(id, filename, options) {
	if(typeof filename !== "string") {
		options = filename;
		filename = id;
		id = ++nextId;
	}
	if(!options) options = {};
	this.filename = filename;
	this.options = options;
	this.id = id;
}
module.exports = ExtractTextPlugin;

function mergeOptions(a, b) {
	if(!b) return a;
	Object.keys(b).forEach(function(key) {
		a[key] = b[key];
	});
	return a;
}

ExtractTextPlugin.loader = function(options) {
	return require.resolve("./loader") + (options ? "?" + JSON.stringify(options) : "");
};

ExtractTextPlugin.extract = function(before, loader, options) {
	if(typeof loader === "string" || Array.isArray(loader)) {
		if(typeof before === "string") {
			before = before.split("!");
		}
		return [
			ExtractTextPlugin.loader(mergeOptions({omit: before.length, extract: true, remove: true}, options))
		].concat(before, loader).join("!");
	} else {
		options = loader;
		loader = before;
		return [
			ExtractTextPlugin.loader(mergeOptions({remove: true}, options))
		].concat(loader).join("!");
	}
};

ExtractTextPlugin.prototype.applyAdditionalInformation = function(source, info) {
	if(info) {
		return new ConcatSource(
			"@media " + info[0] + " {",
			source,
			"}"
		);
	}
	return source;
};

ExtractTextPlugin.prototype.loader = function(options) {
	options = JSON.parse(JSON.stringify(options || {}));
	options.id = this.id;
	return ExtractTextPlugin.loader(options);
};

ExtractTextPlugin.prototype.extract = function(before, loader, options) {
	if(typeof loader === "string" || Array.isArray(loader)) {
		if(typeof before === "string") {
			before = before.split("!");
		}
		return [
			this.loader(mergeOptions({omit: before.length, extract: true, remove: true}, options))
		].concat(before, loader).join("!");
	} else {
		options = loader;
		loader = before;
		return [
			this.loader(mergeOptions({remove: true}, options))
		].concat(loader).join("!");
	}
};

ExtractTextPlugin.prototype.apply = function(compiler) {
	var options = this.options;
	compiler.plugin("this-compilation", function(compilation) {
		var extractCompilation = new ExtractTextPluginCompilation();
		compilation.plugin("normal-module-loader", function(loaderContext, module) {
			loaderContext[__dirname] = function(content, opt) {
				if(options.disable)
					return false;
				if(!Array.isArray(content) && content !== null)
					throw new Error("Exported value is not a string.");
				module.meta[__dirname] = {
					content: content,
					options: opt || {}
				};
				return options.allChunks || module.meta[__dirname + "/extract"]; // eslint-disable-line no-path-concat
			};
		});
		var filename = this.filename;
		var id = this.id;
		var extractedChunks, entryChunks, initialChunks;
		compilation.plugin("optimize", function() {
			entryChunks = compilation.chunks.filter(function(c) {
				return c.entry;
			});
			initialChunks = compilation.chunks.filter(function(c) {
				return c.initial;
			});
		});
		compilation.plugin("optimize-tree", function(chunks, modules, callback) {
			extractedChunks = chunks.map(function() {
				return new Chunk();
			});
			chunks.forEach(function(chunk, i) {
				var extractedChunk = extractedChunks[i];
				extractedChunk.index = i;
				extractedChunk.originalChunk = chunk;
				extractedChunk.name = chunk.name;
				extractedChunk.entry = chunk.entry;
				extractedChunk.initial = chunk.initial;
				chunk.chunks.forEach(function(c) {
					extractedChunk.addChunk(extractedChunks[chunks.indexOf(c)]);
				});
				chunk.parents.forEach(function(c) {
					extractedChunk.addParent(extractedChunks[chunks.indexOf(c)]);
				});
			});
			entryChunks.forEach(function(chunk) {
				var idx = chunks.indexOf(chunk);
				if(idx < 0) return;
				var extractedChunk = extractedChunks[idx];
				extractedChunk.entry = true;
			});
			initialChunks.forEach(function(chunk) {
				var idx = chunks.indexOf(chunk);
				if(idx < 0) return;
				var extractedChunk = extractedChunks[idx];
				extractedChunk.initial = true;
			});
			async.forEach(chunks, function(chunk, callback) {
				var extractedChunk = extractedChunks[chunks.indexOf(chunk)];
				var shouldExtract = !!(options.allChunks || chunk.initial);
				async.forEach(chunk.modules.slice(), function(module, callback) {
					var meta = module.meta && module.meta[__dirname];
					if(meta && (!meta.options.id || meta.options.id === id)) {
						var wasExtracted = Array.isArray(meta.content);
						if(shouldExtract !== wasExtracted) {
							module.meta[__dirname + "/extract"] = shouldExtract; // eslint-disable-line no-path-concat
							compilation.rebuildModule(module, function(err) {
								if(err) {
									compilation.errors.push(err);
									return callback();
								}
								meta = module.meta[__dirname];
								if(!Array.isArray(meta.content)) {
									err = new Error(module.identifier() + " doesn't export content");
									compilation.errors.push(err);
									return callback();
								}
								if(meta.content)
									extractCompilation.addResultToChunk(module.identifier(), meta.content, module, extractedChunk);
								callback();
							});
						} else {
							if(meta.content)
								extractCompilation.addResultToChunk(module.identifier(), meta.content, module, extractedChunk);
							callback();
						}
					} else callback();
				}, function(err) {
					if(err) return callback(err);
					callback();
				});
			}, function(err) {
				if(err) return callback(err);
				extractedChunks.forEach(function(extractedChunk) {
					if(extractedChunk.initial)
						this.mergeNonInitialChunks(extractedChunk);
				}, this);
				extractedChunks.forEach(function(extractedChunk) {
					if(!extractedChunk.initial) {
						extractedChunk.modules.forEach(function(module) {
							extractedChunk.removeModule(module);
						});
					}
				});
				compilation.applyPlugins("optimize-extracted-chunks", extractedChunks);
				callback();
			}.bind(this));
		}.bind(this));
		compilation.plugin("additional-assets", function(callback) {
			extractedChunks.forEach(function(extractedChunk) {
				if(extractedChunk.modules.length) {
					extractedChunk.modules.sort(function(a, b) {
						if(isInvalidOrder(a, b)) {
							compilation.errors.push(new OrderUndefinedError(a.getOriginalModule()));
							compilation.errors.push(new OrderUndefinedError(b.getOriginalModule()));
						}
						return getOrder(a, b);
					});
					var chunk = extractedChunk.originalChunk;
					var source = this.renderExtractedChunk(extractedChunk);
					var file = compilation.getPath(filename, {
						chunk: chunk
					}).replace(/\[(?:(\w+):)?contenthash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, function() {
						return loaderUtils.getHashDigest(source.source(), arguments[1], arguments[2], parseInt(arguments[3], 10));
					});
					compilation.assets[file] = source;
					chunk.files.push(file);
				}
			}, this);
			callback();
		}.bind(this));
	}.bind(this));
};
