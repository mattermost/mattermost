/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var getPaths = require("./getPaths");
var forEachBail = require("./forEachBail");
var assign = require("object-assign");

function SymlinkPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = SymlinkPlugin;

SymlinkPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	resolver.plugin(this.source, function(request, callback) {
		var _this = this;
		var fs = _this.fileSystem;
		var pathsResult = getPaths(request.path);
		var pathSeqments = pathsResult.seqments;
		var paths = pathsResult.paths;

		var containsSymlink = false;
		forEachBail(paths.map(function(_, i) {
			return i;
		}), function(idx, callback) {
			fs.readlink(paths[idx], function(err, result) {
				if(!err && result) {
					pathSeqments[idx] = result;
					containsSymlink = true;
					// Shortcut when absolute symlink found
					if(/^(\/|[a-zA-z]:($|\\))/.test(result))
						return callback(null, idx);
				}
				callback();
			});
		}, function(err, idx) {
			if(!containsSymlink) return callback();
			var resultSeqments = typeof idx === "number" ? pathSeqments.slice(0, idx + 1) : pathSeqments.slice();
			var result = resultSeqments.reverse().reduce(function(a, b) {
				return _this.join(a, b);
			});
			var obj = assign({}, request, {
				path: result
			});
			resolver.doResolve(target, obj, "resolved symlink to " + result, callback);
		});
	});
};
