/*globals describe it beforeEach afterEach */
require("should");
var path = require("path");
var TestHelper = require("./helpers/TestHelper");
var OrgDirectoryWatcher = require("../lib/DirectoryWatcher");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

var openWatchers = [];

var DirectoryWatcher = function(p, options) {
	var d = new OrgDirectoryWatcher(p, options);
	openWatchers.push(d);
	var orgClose = d.close;
	d.close = function() {
		orgClose.call(this);
		var idx = openWatchers.indexOf(d);
		if(idx < 0)
			throw new Error("DirectoryWatcher was already closed");
		openWatchers.splice(idx, 1);
	};
	return d;
};

describe("DirectoryWatcher", function() {
	this.timeout(10000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);
	afterEach(function() {
		openWatchers.forEach(function(d) {
			console.log("DirectoryWatcher (" + d.path + ") was not closed.");
			d.close();
		});
	});

	it("should detect a file creation", function(done) {
		var d = new DirectoryWatcher(fixtures, {});
		var a = d.watch(path.join(fixtures, "a"));
		a.on("change", function(mtime) {
			mtime.should.be.type("number");
			Object.keys(d.getTimes()).sort().should.be.eql([
				path.join(fixtures, "a")
			]);
			a.close();
			done();
		});
		testHelper.tick(function() {
			testHelper.file("a");
		});
	});

	it("should detect a file change", function(done) {
		var d = new DirectoryWatcher(fixtures, {});
		testHelper.file("a");
		var a = d.watch(path.join(fixtures, "a"));
		a.on("change", function(mtime) {
			mtime.should.be.type("number");
			a.close();
			done();
		});
		testHelper.tick(function() {
			testHelper.file("a");
		});
	});

	it("should not detect a file change in initial scan", function(done) {
		testHelper.file("a");
		testHelper.tick(function() {
			var d = new DirectoryWatcher(fixtures, {});
			var a = d.watch(path.join(fixtures, "a"));
			a.on("change", function() {
				throw new Error("should not be detected");
			});
			testHelper.tick(function() {
				a.close();
				done();
			});
		});
	});

	it("should detect a file change in initial scan with start date", function(done) {
		var start = new Date();
		testHelper.tick(1000, function() {
			testHelper.file("a");
			testHelper.tick(1000, function() {
				var d = new DirectoryWatcher(fixtures, {});
				var a = d.watch(path.join(fixtures, "a"), start);
				a.on("change", function() {
					a.close();
					done();
				});
			});
		});
	});

	it("should not detect a file change in initial scan without start date", function(done) {
		testHelper.file("a");
		testHelper.tick(function() {
			var d = new DirectoryWatcher(fixtures, {});
			var a = d.watch(path.join(fixtures, "a"));
			a.on("change", function() {
				throw new Error("should not be detected");
			});
			testHelper.tick(function() {
				a.close();
				done();
			});
		});
	});

	var timings = {
		slow: 300,
		fast: 50
	};
	Object.keys(timings).forEach(function(name) {
		var time = timings[name];
		it("should detect multiple file changes (" + name + ")", function(done) {
			var d = new DirectoryWatcher(fixtures, {});
			testHelper.file("a");
			testHelper.tick(function() {
				var a = d.watch(path.join(fixtures, "a"));
				var count = 20;
				var wasChanged = false;
				a.on("change", function(mtime) {
					mtime.should.be.type("number");
					if(!wasChanged) return;
					wasChanged = false;
					if(count-- <= 0) {
						a.close();
						done();
					} else {
						testHelper.tick(time, function() {
							wasChanged = true;
							testHelper.file("a");
						});
					}
				});
				testHelper.tick(function() {
					wasChanged = true;
					testHelper.file("a");
				});
			});
		});
	});
});
