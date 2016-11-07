/*globals describe it beforeEach afterEach */
require("should");
var path = require("path");
var TestHelper = require("./helpers/TestHelper");
var Watchpack = require("../lib/watchpack");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

describe("Watchpack", function() {
	this.timeout(10000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should watch a single file", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = 0;
		w.on("change", function(file) {
			file.should.be.eql(path.join(fixtures, "a"));
			changeEvents++;
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "a")]);
			changeEvents.should.be.eql(1);
			w.close();
			done();
		});
		w.watch([path.join(fixtures, "a")], []);
		testHelper.tick(function() {
			testHelper.file("a");
		});
	});

	it("should watch multiple files", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.sort().should.be.eql([path.join(fixtures, "a"), path.join(fixtures, "b")]);
			changeEvents.should.be.eql([
				path.join(fixtures, "a"),
				path.join(fixtures, "b"),
				path.join(fixtures, "a"),
				path.join(fixtures, "b"),
				path.join(fixtures, "a")
			]);
			Object.keys(w.getTimes()).sort().should.be.eql([
				path.join(fixtures, "a"),
				path.join(fixtures, "b")
			]);
			w.close();
			done();
		});
		w.watch([path.join(fixtures, "a"), path.join(fixtures, "b")], []);
		testHelper.tick(function() {
			testHelper.file("a");
			testHelper.tick(function() {
				testHelper.file("b");
				testHelper.tick(function() {
					testHelper.file("a");
					testHelper.tick(function() {
						testHelper.file("b");
						testHelper.tick(function() {
							testHelper.file("a");
						});
					});
				});
			});
		});
	});

	it("should watch a directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.file(path.join("dir", "a"));
			});
		});
	});

	it("should watch a file than a directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "subdir"));
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(function() {
			w.watch([path.join(fixtures, "dir", "a")], []);
			testHelper.tick(function() {
				w.watch([path.join(fixtures, "dir")], [path.join(fixtures, "dir")]);
				testHelper.tick(function() {
					testHelper.file(path.join("dir", "a"));
				});
			});
		});
	});

	it("should watch a directory (delete file)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "a"));
			});
		});
	});

	it("should watch a directory (delete and recreate file)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([
				path.join(fixtures, "dir", "a"),
				path.join(fixtures, "dir", "b"),
				path.join(fixtures, "dir", "a")
			]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "a"));
				testHelper.tick(function() {
					testHelper.file(path.join("dir", "b"));
					testHelper.tick(function() {
						testHelper.file(path.join("dir", "a"));
					});
				});
			});
		});
	});

	it("should watch a directory (delete directory)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.file(path.join("dir", "sub", "a"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "sub"));
			});
		});
	});

	it("should watch a directory (delete directory2)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "sub"));
			});
		});
	});

	it("should watch already watched directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(function() {
			w.watch([path.join(fixtures, "dir", "a")], []);
			testHelper.tick(function() {
				w.watch([], [path.join(fixtures, "dir")]);
				testHelper.tick(function() {
					testHelper.remove(path.join("dir", "a"));
				});
			});
		});
	});

	it("should watch file in a sub directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub", "a")]);
			var times = w.getTimes();
			times[path.join(fixtures, "dir")].should.be.type("number");
			times[path.join(fixtures, "dir")].should.be.eql(times[path.join(fixtures, "dir", "sub", "a")]);
						times[path.join(fixtures, "dir", "sub")].should.be.eql(times[path.join(fixtures, "dir", "sub", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.file(path.join("dir", "sub", "a"));
			});
		});
	});

	it("should watch file in a sub sub directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if(changeEvents[changeEvents.length - 1] === file)
				return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub", "sub", "a")]);
			Object.keys(w.getTimes()).sort().should.be.eql([
				path.join(fixtures, "dir"),
				path.join(fixtures, "dir", "sub"),
				path.join(fixtures, "dir", "sub", "sub"),
				path.join(fixtures, "dir", "sub", "sub", "a")
			]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.dir(path.join("dir", "sub", "sub"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.file(path.join("dir", "sub", "sub", "a"));
			});
		});
	});

	it("should detect a single change to future timestamps", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var w2 = new Watchpack({
			aggregateTimeout: 1000
		});
		w.on("change", function() {
			throw new Error("should not report change event");
		});
		w.on("aggregated", function() {
			throw new Error("should not report aggregated event");
		});
		testHelper.file("a");
		testHelper.tick(function() {
			w2.watch([path.join(fixtures, "a")], []);
			testHelper.tick(1000, function() { // wait for initial scan
				testHelper.mtime("a", Date.now() + 1000000);
				testHelper.tick(function() {
					w.watch([path.join(fixtures, "a")], []);
					testHelper.tick(function() {
						testHelper.tick(function() {
							w2.close();
							w.close();
							done();
						});
					});
				});
			});
		});
	});

	it("should detect a past change to a file (timestamp)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = 0;
		w.on("change", function(file) {
			file.should.be.eql(path.join(fixtures, "a"));
			changeEvents++;
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "a")]);
			changeEvents.should.be.greaterThan(0);
			w.close();
			done();
		});
		var startTime = Date.now();
		testHelper.tick(function() {
			testHelper.file("a");
			testHelper.tick(function() {
				w.watch([path.join(fixtures, "a")], [], startTime);
			});
		});
	});

	it("should not detect a past change to a file (watched)", function(done) {
		var w2 = new Watchpack();
		var w = new Watchpack();
		w.on("change", function() {
			throw new Error("Should not be detected");
		});
		testHelper.tick(function() {
			testHelper.file("b");
			w2.watch([path.join(fixtures, "b")], []);
			testHelper.tick(1000, function() { // wait for stable state
				testHelper.file("a");
				testHelper.tick(function() {
					var startTime = Date.now();
					testHelper.tick(function() {
						w.watch([path.join(fixtures, "a")], [], startTime);
						testHelper.tick(function() {
							w.close();
							w2.close();
							done();
						});
					});
				});
			});
		});
	});

	it("should detect a past change to a file (watched)", function(done) {
		var w2 = new Watchpack();
		var w = new Watchpack();
		var changeEvents = 0;
		w.on("change", function(file) {
			file.should.be.eql(path.join(fixtures, "a"));
			changeEvents++;
		});
		w.on("aggregated", function(changes) {
			changes.should.be.eql([path.join(fixtures, "a")]);
			changeEvents.should.be.eql(1);
			w.close();
			w2.close();
			done();
		});
		testHelper.tick(function() {
			testHelper.file("b");
			w2.watch([path.join(fixtures, "b")], []);
			testHelper.tick(function() {
				var startTime = Date.now();
				testHelper.tick(function() {
					testHelper.file("a");
					testHelper.tick(function() {
						w.watch([path.join(fixtures, "a")], [], startTime);
					});
				});
			});
		});
	});
});
