/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function globToRegExp(glob) {
	// * [^\\\/]*
	// /**/ /.+/
	// ^* \./.+ (concord special)
	// ? [^\\\/]
	// [!...] [^...]
	// [^...] [^...]
	// / [\\\/]
	// {...,...} (...|...)
	// ?(...|...) (...|...)?
	// +(...|...) (...|...)+
	// *(...|...) (...|...)*
	// @(...|...) (...|...)
	if(/^\(.+\)$/.test(glob)) {
		// allow to pass an RegExp in brackets
		return new RegExp(glob.substr(1, glob.length - 2));
	}
	var tokens = tokenize(glob);
	var process = createRoot();
	var regExpStr = tokens.map(process).join("");
	return new RegExp("^" + regExpStr + "$");
}

var SIMPLE_TOKENS = {
	"@(": "one",
	"?(": "zero-one",
	"+(": "one-many",
	"*(": "zero-many",
	"|": "seqment-sep",
	"/**/": "any-path-seqments",
	"**": "any-path",
	"*": "any-path-seqment",
	"?": "any-char",
	"{": "or",
	"/": "path-sep",
	",": "comma",
	")": "closing-seqment",
	"}": "closing-or"
}

function tokenize(glob) {
	return glob.split(/([@?+*]\(|\/\*\*\/|\*\*|[?*]|\[[\!\^]?(?:[^\]\\]|\\.)+\]|\{|,|\/|[|)}])/g).map(function(item) {
		if(!item)
			return null;
		var t = SIMPLE_TOKENS[item];
		if(t) {
			return {
				type: t
			};
		}
		if(item[0] === "[") {
			if(item[1] === "^" || item[1] === "!") {
				return {
					type: "inverted-char-set",
					value: item.substr(2, item.length - 3)
				};
			} else {
				return {
					type: "char-set",
					value: item.substr(1, item.length - 2)
				};
			}
		}
		return {
			type: "string",
			value: item
		};
	}).filter(Boolean).concat({
		type: "end"
	});
}

function createRoot() {
	var inOr = [];
	var process = createSeqment();
	var initial = true;
	return function(token) {
		switch(token.type) {
			case "or":
				inOr.push(initial);
				return "(";
			case "comma":
				if(inOr.length) {
					initial = inOr[inOr.length - 1]
					return "|";
				} else {
					return process({
						type: "string",
						value: ","
					}, initial);
				}
			case "closing-or":
				if(inOr.length === 0)
					throw new Error("Unmatched '}'");
				inOr.pop();
				return ")";
			case "end":
				if(inOr.length)
					throw new Error("Unmatched '{'");
				return process(token, initial);
			default:
				var result = process(token, initial);
				initial = false;
				return result;
		}
	};
}

function createSeqment() {
	var inSeqment = [];
	var process = createSimple();
	return function(token, initial) {
		switch(token.type) {
			case "one":
			case "one-many":
			case "zero-many":
			case "zero-one":
				inSeqment.push(token.type);
				return "(";
			case "seqment-sep":
				if(inSeqment.length) {
					return "|";
				} else {
					return process({
						type: "string",
						value: "|"
					}, initial);
				}
			case "closing-seqment":
				var seqment = inSeqment.pop();
				switch(seqment) {
					case "one":
						return ")";
					case "one-many":
						return ")+";
					case "zero-many":
						return ")*";
					case "zero-one":
						return ")?";
				}
			case "end":
				if(inSeqment.length > 0) {
					throw new Error("Unmatched segment, missing ')'");
				}
				return process(token, initial);
			default:
				return process(token, initial);
		}
	};
}

function createSimple() {
	return function(token, initial) {
		switch(token.type) {
			case "path-sep":
				return "[\\\\/]+";
			case "any-path-seqments":
				return "[\\\\/]+(?:(.+)[\\\\/]+)?";
			case "any-path":
				return "(.*)";
			case "any-path-seqment":
				if(initial) {
					return "\\.[\\\\/]+(?:.*[\\\\/]+)?([^\\\\/]+)";
				} else {
					return "([^\\\\/]*)";
				}
			case "any-char":
				return "[^\\\\/]";
			case "inverted-char-set":
				return "[^" + token.value + "]";
			case "char-set":
				return "[" + token.value + "]";
			case "string":
				return token.value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
			case "end":
				return "";
			default:
				throw new Error("Unsupported token '" + token.type + "'");
		}
	}
}

exports.globToRegExp = globToRegExp;
