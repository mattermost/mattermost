/*globals describe it beforeEach afterEach */
require("should");
var path = require("path");
var TestHelper = require("./helpers/TestHelper");
var Watchpack = require("../lib/watchpack");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

var fsIsCaseInsensitive;
try {
	fsIsCaseInsensitive = require("fs").realpathSync(path.join(__dirname, "..", "PACKAGE.JSON")) === path.join(__dirname, "..", "package.json");
} catch(e) {
	fsIsCaseInsensitive = false;
}

if(fsIsCaseInsensitive) {

	describe("Casing", function() {
		this.timeout(10000);
		beforeEach(testHelper.before);
		afterEach(testHelper.after);

		it("should watch a file with the wrong casing", function(done) {
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
				testHelper.file("A");
			});
		});
	});
}
