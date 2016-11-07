/*globals describe it */

require("should");
var Parser = require("../");

var testdata = [
	{
		name: "simple string",
		states: {
			"start": {
				"[d-gm-rv]+": function(match, index) {
					if(!this.data) this.data = [];
					this.data.push({
						match: match,
						index: index
					});
				}
			}
		},
		string: "abcdefghijklmnopqrstuvwxyz",
		expected: {
			data: [
				{ match: "defg", index: 3 },
				{ match: "mnopqr", index: 12 },
				{ match: "v", index: 21 }
			]
		}
	},
	{
		name: "state switing",
		states: {
			"number": {
				"([0-9]+)": function(match, number) {
					if(!this.data) this.data = {};
					this.data[this.ident] = +number;
					delete this.ident;
					return "start";
				},
				"-\\?": true,
				"\\?": "start"
			},
			"start": {
				"([a-z]+)": function(match, name) {
					this.ident = name;
					return "number";
				}
			}
		},
		string: "a 1 b 2 c f 3 d ? e -? 4",
		expected: {
			data: {
				a: 1, b: 2, c: 3, e: 4
			}
		}
	},
	{
		name: "state array",
		states: {
			"start": [
				{ "a": function() { this.a = true; } },
				{
					"b": function() { this.b = true; },
					"c": function() { this.c = true; }
				}
			]
		},
		string: "hello abc",
		expected: {
			a: true, b: true, c: true
		}
	},
	{
		name: "reference other states",
		states: {
			"start": [
				{ "a": function() { this.a = true; } },
				"bc"
			],
			"bc": {
				"b": function() { this.b = true; },
				"c": function() { this.c = true; }
			}
		},
		string: "hello abc",
		expected: {
			a: true, b: true, c: true
		}
	}
];

describe("Parser", function() {
	testdata.forEach(function(testcase) {
		it("should parse " + testcase.name, function() {
			var parser = new Parser(testcase.states);
			var actual = parser.parse("start", testcase.string, {});
			actual.should.be.eql(testcase.expected);
		});
	});

	it("should default context to empty object", function() {
		var parser = new Parser({
			"a": {
				"a": function() {
					this.should.be.eql({});
				}
			}
		});
		var result = parser.parse("a", "a");
		result.should.be.eql({});
	});

	it("should error for unexpected format", function() {
		(function() {
			var parser = new Parser({
				"a": 123
			});
			return parser;
		}).should.throw();
	});

	it("should error for not existing state", function() {
		var parser = new Parser({
			"a": {
				"a": "b"
			}
		});
		(function() {
			return parser.parse("a", "a");
		}).should.throw();
	});
});
