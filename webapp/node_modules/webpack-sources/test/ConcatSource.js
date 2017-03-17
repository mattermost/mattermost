var should = require("should");
var ConcatSource = require("../lib/ConcatSource");
var RawSource = require("../lib/RawSource");
var OriginalSource = require("../lib/OriginalSource");

describe("ConcatSource", function() {
	it("should concat two sources", function() {
		var source = new ConcatSource(
			new RawSource("Hello World\n"),
			new OriginalSource("console.log('test');\nconsole.log('test2');\n", "console.js")
		);
		source.add(new OriginalSource("Hello2\n", "hello.md"));
		var expectedMap1 = {
			version: 3,
			file: "x",
			mappings: ";AAAA;AACA;ACDA;",
			sources: [
				"console.js",
				"hello.md"
			],
			sourcesContent: [
				"console.log('test');\nconsole.log('test2');\n",
				"Hello2\n"
			]
		};
		var expectedSource = [
			"Hello World",
			"console.log('test');",
			"console.log('test2');",
			"Hello2",
			""
		].join("\n");
		source.size().should.be.eql(62);
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
			mappings: ";AAAA;AACA;ACDA",
			names: [],
			sources: [
				"console.js",
				"hello.md"
			],
			sourcesContent: [
				"console.log('test');\nconsole.log('test2');\n",
				"Hello2\n"
			]
		};
		source.map().should.be.eql(expectedMap2);
		source.sourceAndMap().should.be.eql({
			source: expectedSource,
			map: expectedMap2
		});
	});
});
