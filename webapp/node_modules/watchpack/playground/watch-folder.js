var path = require("path");
var Watchpack = require("../");

var folder = path.join(__dirname, "folder");

function startWatcher(name, files, folders) {
	var w = new Watchpack({
		aggregateTimeout: 3000
	});

	w.on("change", function(file, mtime) {
		console.log(name, "change", path.relative(folder, file), mtime);
	});

	w.on("aggregated", function(changes) {
		var times = w.getTimes();
		console.log(name, "aggregated", changes.map(function(file) {
			return path.relative(folder, file);
		}), Object.keys(times).reduce(function(obj, file) {
			obj[path.relative(folder, file)] = times[file];
			return obj
		}, {}));
	});

	var startTime = Date.now() - 10000;
	console.log(name, startTime);
	w.watch(files, folders, startTime);
}

startWatcher("folder", [], [folder]);
startWatcher("sub+files", [
	path.join(folder, "a.txt"),
	path.join(folder, "b.txt"),
	path.join(folder, "c.txt"),
	path.join(folder, "d.txt"),
], [
	path.join(folder, "subfolder")
]);
