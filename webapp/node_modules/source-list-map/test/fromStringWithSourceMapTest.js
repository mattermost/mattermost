var should = require("should");
var fs = require("fs");
var path = require("path");
var SourceListMap = require("../").SourceListMap;
var fromStringWithSourceMap = require("../").fromStringWithSourceMap;

describe("fromStringWithSourceMap", function() {
	fs.readdirSync(path.resolve(__dirname, "fixtures/from-to-tests")).filter(function(name) {
		return /\.input\.map$/.test(name);
	}).forEach(function(name) {
		it("should parse and generate " + name, function() {
			var MAP = JSON.parse(fs.readFileSync(path.resolve(__dirname, "fixtures/from-to-tests/" + name), "utf-8"));
			var GENERATED_CODE = fs.readFileSync(path.resolve(__dirname, "fixtures/from-to-tests/" + MAP.file), "utf-8");
			var EXPECTED_MAP = JSON.parse(fs.readFileSync(path.resolve(__dirname, "fixtures/from-to-tests/" + 
				name.replace(/\.input\.map$/, ".expected.map")), "utf-8"));
			var slm = fromStringWithSourceMap(GENERATED_CODE, MAP);
			var result = slm.toStringWithSourceMap({
				file: MAP.file
			});
			if(result.map.mappings !== EXPECTED_MAP.mappings) {
				fs.writeFileSync(path.resolve(__dirname, "fixtures/from-to-tests/" + 
				name.replace(/\.input\.map$/, ".output.map")), JSON.stringify(result.map, null, 2), "utf-8");
			}
			JSON.parse(JSON.stringify(result.map)).should.be.eql(EXPECTED_MAP);
			if(result.source !== GENERATED_CODE) {
				fs.writeFileSync(path.resolve(__dirname, "fixtures/from-to-tests/" + 
				path.basename(MAP.file, path.extname(MAP.file)) + ".output" + path.extname(MAP.file)), result.source, "utf-8");
			}
			result.source.should.be.eql(GENERATED_CODE);

			slm = fromStringWithSourceMap(GENERATED_CODE, EXPECTED_MAP);
			result = slm.toStringWithSourceMap({
				file: MAP.file
			});
			result.source.should.be.eql(GENERATED_CODE);
			JSON.parse(JSON.stringify(result.map)).should.be.eql(EXPECTED_MAP);
		});

	});
});
