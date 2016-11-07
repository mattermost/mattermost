var should = require("should");
var path = require("path");
var runLoaders = require("../").runLoaders;
var getContext = require("../").getContext;

var fixtures = path.resolve(__dirname, "fixtures");

describe("runLoaders", function() {
	it("should process only a resource", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin")
		}, function(err, result) {
			if(err) return done(err);
			result.result.should.be.eql([new Buffer("resource", "utf-8")]);
			result.cacheable.should.be.eql(true);
			result.fileDependencies.should.be.eql([
				path.resolve(fixtures, "resource.bin")
			]);
			result.contextDependencies.should.be.eql([]);
			done();
		});
	});
	it("should process a simple sync loader", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin"),
			loaders: [
				path.resolve(fixtures, "simple-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			result.result.should.be.eql(["resource-simple"]);
			result.cacheable.should.be.eql(true);
			result.fileDependencies.should.be.eql([
				path.resolve(fixtures, "resource.bin")
			]);
			result.contextDependencies.should.be.eql([]);
			done();
		});
	});
	it("should process a simple async loader", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin"),
			loaders: [
				path.resolve(fixtures, "simple-async-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			result.result.should.be.eql(["resource-async-simple"]);
			result.cacheable.should.be.eql(true);
			result.fileDependencies.should.be.eql([
				path.resolve(fixtures, "resource.bin")
			]);
			result.contextDependencies.should.be.eql([]);
			done();
		});
	});
	it("should process a simple promise loader", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin"),
			loaders: [
				path.resolve(fixtures, "simple-promise-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			result.result.should.be.eql(["resource-promise-simple"]);
			result.cacheable.should.be.eql(true);
			result.fileDependencies.should.be.eql([
				path.resolve(fixtures, "resource.bin")
			]);
			result.contextDependencies.should.be.eql([]);
			done();
		});
	});
	it("should process multiple simple loaders", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin"),
			loaders: [
				path.resolve(fixtures, "simple-async-loader.js"),
				path.resolve(fixtures, "simple-loader.js"),
				path.resolve(fixtures, "simple-async-loader.js"),
				path.resolve(fixtures, "simple-async-loader.js"),
				path.resolve(fixtures, "simple-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			result.result.should.be.eql(["resource-simple-async-simple-async-simple-simple-async-simple"]);
			result.cacheable.should.be.eql(true);
			result.fileDependencies.should.be.eql([
				path.resolve(fixtures, "resource.bin")
			]);
			result.contextDependencies.should.be.eql([]);
			done();
		});
	});
	it("should process pitching loaders", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin"),
			loaders: [
				path.resolve(fixtures, "simple-loader.js"),
				path.resolve(fixtures, "pitching-loader.js"),
				path.resolve(fixtures, "simple-async-loader.js"),
			]
		}, function(err, result) {
			if(err) return done(err);
			result.result.should.be.eql([
				path.resolve(fixtures, "simple-async-loader.js") + "!" +
				path.resolve(fixtures, "resource.bin") + ":" +
				path.resolve(fixtures, "simple-loader.js") +
				"-simple"
			]);
			result.cacheable.should.be.eql(true);
			result.fileDependencies.should.be.eql([]);
			result.contextDependencies.should.be.eql([]);
			done();
		});
	});
	it("should be possible to add dependencies", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin"),
			loaders: [
				path.resolve(fixtures, "dependencies-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			result.cacheable.should.be.eql(true);
			result.fileDependencies.should.be.eql(["a", "b"]);
			result.contextDependencies.should.be.eql(["c"]);
			result.result.should.be.eql(["resource\n" + JSON.stringify(["a", "b"]) + JSON.stringify(["c"])]);
			done();
		});
	});
	it("should have to correct keys in context", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin") + "?query",
			loaders: [
				path.resolve(fixtures, "keys-loader.js") + "?loader-query",
				path.resolve(fixtures, "simple-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			try {
				JSON.parse(result.result[0]).should.be.eql({
					context: fixtures,
					resource: path.resolve(fixtures, "resource.bin") + "?query",
					resourcePath: path.resolve(fixtures, "resource.bin"),
					resourceQuery: "?query",
					loaderIndex: 0,
					query: "?loader-query",
					currentRequest: path.resolve(fixtures, "keys-loader.js") + "?loader-query!" +
						path.resolve(fixtures, "simple-loader.js") + "!" +
						path.resolve(fixtures, "resource.bin") + "?query",
					remainingRequest: path.resolve(fixtures, "simple-loader.js") + "!" +
						path.resolve(fixtures, "resource.bin") + "?query",
					previousRequest: "",
					request: path.resolve(fixtures, "keys-loader.js") + "?loader-query!" +
						path.resolve(fixtures, "simple-loader.js") + "!" +
						path.resolve(fixtures, "resource.bin") + "?query",
					data: null,
					loaders: [{
						request: path.resolve(fixtures, "keys-loader.js") + "?loader-query",
						path: path.resolve(fixtures, "keys-loader.js"),
						query: "?loader-query",
						data: null,
						pitchExecuted: true,
						normalExecuted: true
					}, {
						request: path.resolve(fixtures, "simple-loader.js"),
						path: path.resolve(fixtures, "simple-loader.js"),
						query: "",
						data: null,
						pitchExecuted: true,
						normalExecuted: true
					}]
				})
			} catch(e) {
				return done(e);
			}
			done();
		});
	});
	it("should have to correct keys in context (with options)", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin") + "?query",
			loaders: [{
				loader: path.resolve(fixtures, "keys-loader.js"),
				options: {
					ident: "ident",
					loader: "query"
				}
			}]
		}, function(err, result) {
			if(err) return done(err);
			try {
				JSON.parse(result.result[0]).should.be.eql({
					context: fixtures,
					resource: path.resolve(fixtures, "resource.bin") + "?query",
					resourcePath: path.resolve(fixtures, "resource.bin"),
					resourceQuery: "?query",
					loaderIndex: 0,
					query: {
						ident: "ident",
						loader: "query"
					},
					currentRequest: path.resolve(fixtures, "keys-loader.js") + "??ident!" +
						path.resolve(fixtures, "resource.bin") + "?query",
					remainingRequest: path.resolve(fixtures, "resource.bin") + "?query",
					previousRequest: "",
					request: path.resolve(fixtures, "keys-loader.js") + "??ident!" +
						path.resolve(fixtures, "resource.bin") + "?query",
					data: null,
					loaders: [{
						request: path.resolve(fixtures, "keys-loader.js") + "??ident",
						path: path.resolve(fixtures, "keys-loader.js"),
						query: "??ident",
						options: {
							ident: "ident",
							loader: "query"
						},
						data: null,
						pitchExecuted: true,
						normalExecuted: true
					}]
				})
			} catch(e) {
				return done(e);
			}
			done();
		});
	});
	it("should process raw loaders", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "bom.bin"),
			loaders: [
				path.resolve(fixtures, "raw-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			result.result[0].toString("utf-8").should.be.eql(
				"efbbbf62c3b66d﻿böm"
			);
			done();
		});
	});
	it("should process omit BOM on string convertion", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "bom.bin"),
			loaders: [
				path.resolve(fixtures, "raw-loader.js"),
				path.resolve(fixtures, "simple-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			result.result[0].toString("utf-8").should.be.eql(
				"62c3b66d2d73696d706c65böm-simple"
			);
			done();
		});
	});
	it("should have to correct keys in context without resource", function(done) {
		runLoaders({
			loaders: [
				path.resolve(fixtures, "identity-loader.js"),
				path.resolve(fixtures, "keys-loader.js"),
			]
		}, function(err, result) {
			if(err) return done(err);
			try {
				JSON.parse(result.result[0]).should.be.eql({
					context: null,
					loaderIndex: 1,
					query: "",
					currentRequest: path.resolve(fixtures, "keys-loader.js") + "!",
					remainingRequest: "",
					previousRequest: path.resolve(fixtures, "identity-loader.js"),
					request: path.resolve(fixtures, "identity-loader.js") + "!" +
						path.resolve(fixtures, "keys-loader.js") + "!",
					data: null,
					loaders: [{
						request: path.resolve(fixtures, "identity-loader.js"),
						path: path.resolve(fixtures, "identity-loader.js"),
						query: "",
						data: {
							identity: true
						},
						pitchExecuted: true,
						normalExecuted: false
					}, {
						request: path.resolve(fixtures, "keys-loader.js"),
						path: path.resolve(fixtures, "keys-loader.js"),
						query: "",
						data: null,
						pitchExecuted: true,
						normalExecuted: true
					}]
				})
			} catch(e) {
				return done(e);
			}
			done();
		});
	});
	it("should have to correct keys in context with only resource query", function(done) {
		runLoaders({
			resource: "?query",
			loaders: [
				path.resolve(fixtures, "keys-loader.js"),
			]
		}, function(err, result) {
			if(err) return done(err);
			try {
				JSON.parse(result.result[0]).should.be.eql({
					context: null,
					resource: "?query",
					resourcePath: "",
					resourceQuery: "?query",
					loaderIndex: 0,
					query: "",
					currentRequest: path.resolve(fixtures, "keys-loader.js") + "!?query",
					remainingRequest: "?query",
					previousRequest: "",
					request: path.resolve(fixtures, "keys-loader.js") + "!" +
						"?query",
					data: null,
					loaders: [{
						request: path.resolve(fixtures, "keys-loader.js"),
						path: path.resolve(fixtures, "keys-loader.js"),
						query: "",
						data: null,
						pitchExecuted: true,
						normalExecuted: true
					}]
				})
			} catch(e) {
				return done(e);
			}
			done();
		});
	});
	it("should allow to change loader order and execution", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "bom.bin"),
			loaders: [
				path.resolve(fixtures, "change-stuff-loader.js"),
				path.resolve(fixtures, "simple-loader.js"),
				path.resolve(fixtures, "simple-loader.js")
			]
		}, function(err, result) {
			if(err) return done(err);
			result.result.should.be.eql([
				"resource"
			]);
			done();
		});
	});
	it("should return dependencies even if resource is missing", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "missing.txt"),
			loaders: [
				path.resolve(fixtures, "pitch-dependencies-loader.js")
			]
		}, function(err, result) {
			err.should.be.instanceOf(Error);
			err.message.should.match(/ENOENT/i);
			result.fileDependencies.should.be.eql([
				"remainingRequest:" + path.resolve(fixtures, "missing.txt"),
				path.resolve(fixtures, "missing.txt")
			]);
			done();
		});
	});
	it("should return dependencies even if loader is failing", function(done) {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin"),
			loaders: [
				path.resolve(fixtures, "failing-loader.js")
			]
		}, function(err, result) {
			err.should.be.instanceOf(Error);
			err.message.should.match(/^resource$/i);
			result.fileDependencies.should.be.eql([
				path.resolve(fixtures, "resource.bin")
			]);
			done();
		});
	});
	describe("getContext", function() {
		var TESTS = [
			["/", "/"],
			["/path/file.js", "/path"],
			["/some/longer/path/file.js", "/some/longer/path"],
			["/file.js", "/"],
			["C:\\", "C:\\"],
			["C:\\file.js", "C:\\"],
			["C:\\some\\path\\file.js", "C:\\some\\path"],
			["C:\\path\\file.js", "C:\\path"],
		];
		TESTS.forEach(function(testCase) {
			it("should get the context of '" + testCase[0] + "'", function() {
				getContext(testCase[0]).should.be.eql(testCase[1]);
			});
		});
	})
});
