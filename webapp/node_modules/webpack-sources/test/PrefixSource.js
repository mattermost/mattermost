var should = require("should");
var PrefixSource = require("../lib/PrefixSource");
var RawSource = require("../lib/RawSource");
var OriginalSource = require("../lib/OriginalSource");

describe("PrefixSource", function() {
	it("should prefix a source", function() {
		var source = new PrefixSource(
			"\t",
			new OriginalSource("console.log('test');console.log('test2');\nconsole.log('test22');\n", "console.js")
		);
		var expectedMap1 = {
			version: 3,
			file: "x",
			mappings: "AAAA;AACA;",
			sources: [
				"console.js"
			],
			sourcesContent: [
				"console.log('test');console.log('test2');\nconsole.log('test22');\n"
			]
		};
		var expectedSource = [
			"\tconsole.log('test');console.log('test2');",
			"\tconsole.log('test22');",
			""
		].join("\n");
		source.size().should.be.eql(67);
		source.source().should.be.eql(expectedSource);
		source.map({
			columns: false
		}).should.be.eql(expectedMap1);
		source.sourceAndMap({
			columns: false
		}).should.be.eql({
			source: expectedSource,
			map: expectedMap1
		});
		var expectedMap2 = {
			version: 3,
			file: "x",
			mappings: "AAAA,qBAAoB;AACpB",
			names: [],
			sources: [
				"console.js"
			],
			sourcesContent: [
				"console.log('test');console.log('test2');\nconsole.log('test22');\n"
			]
		};
		source.map().should.be.eql(expectedMap2);
		source.sourceAndMap().should.be.eql({
			source: expectedSource,
			map: expectedMap2
		});
	});
});
