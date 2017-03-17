var fs = require("fs");
var path = require("path");
var rimraf = require("rimraf");

var watcherManager = require("../../lib/watcherManager");

function TestHelper(testdir) {
	this.testdir = testdir;
	var self = this;
	this.before = function(done) {
		self._before(done);
	};
	this.after = function(done) {
		self._after(done);
	};
}
module.exports = TestHelper;

TestHelper.prototype._before = function before(done) {
	Object.keys(watcherManager.directoryWatchers).should.be.eql([]);
	this.tick(function() {
		rimraf.sync(this.testdir);
		fs.mkdirSync(this.testdir);
		done();
	}.bind(this));
};

TestHelper.prototype._after = function after(done) {
	var i = 0;
	this.tick(300, function del() {
		try {
			rimraf.sync(this.testdir);
		} catch(e) {
			if(i++ > 20) throw e;
			this.tick(100, del.bind(this));
			return;
		}
		Object.keys(watcherManager.directoryWatchers).should.be.eql([]);
		this.tick(300, done);
	}.bind(this));
};

TestHelper.prototype.dir = function dir(name) {
	fs.mkdirSync(path.join(this.testdir, name));
};

TestHelper.prototype.file = function file(name) {
	fs.writeFileSync(path.join(this.testdir, name), Math.random() + "", "utf-8");
};

TestHelper.prototype.mtime = function mtime(name, mtime) {
	var stats = fs.statSync(path.join(this.testdir, name));
	fs.utimesSync(path.join(this.testdir, name), stats.atime, new Date(mtime));
};

TestHelper.prototype.remove = function remove(name) {
	rimraf.sync(path.join(this.testdir, name));
};

TestHelper.prototype.tick = function tick(arg, fn) {
	if(typeof arg === "function") {
		fn = arg;
		arg = 100;
	}
	setTimeout(function() {
		fn();
	}, arg);
};
