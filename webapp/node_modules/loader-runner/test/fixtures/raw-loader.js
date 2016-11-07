exports.__es6Module = true;
exports.default = function(source) {
	return new Buffer(source.toString("hex") + source.toString("utf-8"), "utf-8");
};
exports.raw = true;
