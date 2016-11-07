/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var globToRegExp = require("./globToRegExp").globToRegExp;

function parseType(type) {
	var items = type.split("+");
	var t = items.shift();
	return {
		type: t === "*" ? null : t,
		features: items
	};
}

function isTypeMatched(baseType, testedType) {
	if(typeof baseType === "string") baseType = parseType(baseType);
	if(typeof testedType === "string") testedType = parseType(testedType);
	if(testedType.type && testedType.type !== baseType.type) return false;
	return testedType.features.every(function(requiredFeature) {
		return baseType.features.indexOf(requiredFeature) >= 0;
	});
}

function isResourceTypeMatched(baseType, testedType) {
	baseType = baseType.split("/");
	testedType = testedType.split("/");
	if(baseType.length !== testedType.length) return false;
	for(var i = 0; i < baseType.length; i++) {
		if(!isTypeMatched(baseType[i], testedType[i]))
			return false;
	}
	return true;
}

function isResourceTypeSupported(context, type) {
	return context.supportedResourceTypes && context.supportedResourceTypes.some(function(supportedType) {
		return isResourceTypeMatched(supportedType, type);
	});
}

function isEnvironment(context, env) {
	return context.environments && context.environments.every(function(environment) {
		return isTypeMatched(environment, env);
	});
}

var globCache = {};

function getGlobRegExp(glob) {
	var regExp = globCache[glob] || (globCache[glob] = globToRegExp(glob));
	return regExp;
}

function matchGlob(glob, relativePath) {
	var regExp = getGlobRegExp(glob);
	return regExp.exec(relativePath);
}

function isGlobMatched(glob, relativePath) {
	return !!matchGlob(glob, relativePath);
}

function isConditionMatched(context, condition) {
	var items = condition.split("|");
	return items.some(function testFn(item) {
		item = item.trim();
		var inverted = /^!/.test(item);
		if(inverted) return !testFn(item.substr(1));
		if(/^[a-z]+:/.test(item)) {
			// match named condition
			var match = /^([a-z]+):\s*/.exec(item);
			var value = item.substr(match[0].length);
			var name = match[1];
			switch(name) {
				case "referrer":
					return isGlobMatched(value, context.referrer);
				default:
					return false;
			}
		} else if(item.indexOf("/") >= 0) {
			// match supported type
			return isResourceTypeSupported(context, item);
		} else {
			// match environment
			return isEnvironment(context, item);
		}
	})
}

function isKeyMatched(context, key) {
	while(true) {
		var match = /^\[([^\]]+)\]\s*/.exec(key);
		if(!match) return key;
		key = key.substr(match[0].length);
		var condition = match[1];
		if(!isConditionMatched(context, condition)) {
			return false;
		}
	}
}

function getField(context, configuration, field) {
	var value;
	Object.keys(configuration).forEach(function(key) {
		var pureKey = isKeyMatched(context, key);
		if(pureKey === field) {
			value = configuration[key];
		}
	});
	return value;
}

function getMain(context, configuration) {
	return getField(context, configuration, "main");
}

function getExtensions(context, configuration) {
	return getField(context, configuration, "extensions");
}

function matchModule(context, configuration, request) {
	var modulesField = getField(context, configuration, "modules");
	if(!modulesField) return request;
	var newRequest = request;
	var keys = Object.keys(modulesField);
	var iteration = 0;
	for(var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var pureKey = isKeyMatched(context, key);
		var match = matchGlob(pureKey, newRequest);
		if(match) {
			var value = modulesField[key];
			if(typeof value !== "string") {
				return value;
			} else if(/^\(.+\)$/.test(pureKey)) {
				newRequest = newRequest.replace(getGlobRegExp(pureKey), value);
			} else {
				var index = 1;
				newRequest = value.replace(/(\/?\*)?\*/g, replaceMatcher);
			}
			i = -1;
			if(iteration++ > keys.length) {
				throw new Error("Request '" + request + "' matches recursively");
			}
		}
	}
	return newRequest;

	function replaceMatcher(find) {
		switch(find) {
			case "/**":
				var m = match[index++];
				return m ? "/" + m : "";
			case "**":
			case "*":
				return match[index++];
		}
	}
}

function matchType(context, configuration, relativePath) {
	var typesField = getField(context, configuration, "types");
	if(!typesField) return undefined;
	var type;
	Object.keys(typesField).forEach(function(key) {
		var pureKey = isKeyMatched(context, key);
		if(isGlobMatched(pureKey, relativePath)) {
			var value = typesField[key];
			if(!type && /\/\*$/.test(value))
				throw new Error("value ('" + value + "') of key '" + key + "' contains '*', but there is no previous value defined");
			type = value.replace(/\/\*$/, "/" + type);
		}
	});
	return type;
}

exports.parseType = parseType;
exports.isTypeMatched = isTypeMatched;
exports.isResourceTypeSupported = isResourceTypeSupported;
exports.isEnvironment = isEnvironment;
exports.isGlobMatched = isGlobMatched;
exports.isConditionMatched = isConditionMatched;
exports.isKeyMatched = isKeyMatched;
exports.getField = getField;
exports.getMain = getMain;
exports.getExtensions = getExtensions;
exports.matchModule = matchModule;
exports.matchType = matchType;
