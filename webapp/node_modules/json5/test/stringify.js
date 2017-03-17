// tests stringify()

/*global require console exports */

// set to true to show performance stats
var DEBUG = false;

var assert = require('assert');
var JSON5 = require('../lib/json5');

// Test JSON5.stringify() by comparing its output for each case with 
// native JSON.stringify().  The only differences will be in how object keys are 
// handled.

var simpleCases = [
    null,
    9, -9, +9, +9.878,
    '', "''", '999', '9aa', 'aaa', 'aa a', 'aa\na', 'aa\\a', '\'', '\\\'', '\\"',
    undefined,
    true, false,
    {}, [], function(){},
    Date.now(), new Date(Date.now())
];

exports.stringify = {};
exports.stringify.simple = function test() {
    for (var i=0; i<simpleCases.length; i++) {
        assertStringify(simpleCases[i]);
    }
};

exports.stringify.oddities = function test() {
    assertStringify(Function);
    assertStringify(Date);
    assertStringify(Object);
    assertStringify(NaN);
    assertStringify(Infinity);
    assertStringify(10e6);
    assertStringify(19.3223e6);
    assertStringify(077);
    assertStringify(0x99);
    assertStringify(/aa/);
    assertStringify(new RegExp('aa'));
    
    assertStringify(new Number(7));
    assertStringify(new String(7));
    assertStringify(new String(""));
    assertStringify(new String("abcde"));
    assertStringify(new String(new String("abcde")));
    assertStringify(new Boolean(true));
    assertStringify(new Boolean());
};

exports.stringify.arrays = function test() {
    assertStringify([""]);
    assertStringify([1, 2]);
    assertStringify([undefined]);
    assertStringify([1, 'fasds']);
    assertStringify([1, '\n\b\t\f\r\'']);
    assertStringify([1, 'fasds', ['fdsafsd'], null]);
    assertStringify([1, 'fasds', ['fdsafsd'], null, function(aaa) { return 1; }, false ]);
    assertStringify([1, 'fasds', ['fdsafsd'], undefined, function(aaa) { return 1; }, false ]);
};

exports.stringify.objects = function test() {
    assertStringify({a:1, b:2});
    assertStringify({"":1, b:2});
    assertStringify({9:1, b:2});
    assertStringify({"9aaa":1, b:2});
    assertStringify({aaaa:1, bbbb:2});
    assertStringify({a$a_aa:1, bbbb:2});
    assertStringify({"a$a_aa":1, 'bbbb':2});
    assertStringify({"a$a_aa":[1], 'bbbb':{a:2}});
    assertStringify({"a$22222_aa":[1], 'bbbb':{aaaa:2, name:function(a,n,fh,h) { return 'nuthin'; }, foo: undefined}});
    assertStringify({"a$222222_aa":[1], 'bbbb':{aaaa:2, name:'other', foo: undefined}});
    assertStringify({"a$222222_aa":[1, {}, undefined, function() { }, { jjj: function() { } }], 'bbbb':{aaaa:2, name:'other', foo: undefined}});
    
    // using same obj multiple times
    var innerObj = {a: 9, b:6};
    assertStringify({a : innerObj, b: innerObj, c: [innerObj, innerObj, innerObj]});
};

exports.stringify.oddKeys = function test() {
    assertStringify({"this is a crazy long key":1, 'bbbb':2});
    assertStringify({"":1, 'bbbb':2});
    assertStringify({"s\ns":1, 'bbbb':2});
    assertStringify({'\n\b\t\f\r\'\\':1, 'bbbb':2});
    assertStringify({undefined:1, 'bbbb':2});
    assertStringify({'\x00':'\x00'});
};

// we expect errors from all of these tests.  The errors should match
exports.stringify.circular = function test() {
    var obj = { };
    obj.obj = obj;
    assertStringify(obj, null, true);

    var obj2 = {inner1: {inner2: {}}};
    obj2.inner1.inner2.obj = obj2;
    assertStringify(obj2, null, true);

    var obj3 = {inner1: {inner2: []}};
    obj3.inner1.inner2[0] = obj3;
    assertStringify(obj3, null, true);
};

exports.stringify.replacerType = function test() {
    var assertStringifyJSON5ThrowsExceptionForReplacer = function(replacer) {
        assert.throws(
            function() { JSON5.stringify(null, replacer); },
            /Replacer must be a function or an array/
        );
    };
    assertStringifyJSON5ThrowsExceptionForReplacer('string');
    assertStringifyJSON5ThrowsExceptionForReplacer(123);
    assertStringifyJSON5ThrowsExceptionForReplacer({});
};

exports.stringify.replacer = {};
exports.stringify.replacer.function = {};

exports.stringify.replacer.function.simple = function test() {
    function replacerTestFactory(expectedValue) {
        return function() {
            var lastKey = null,
                lastValue = null,
                numCalls = 0,
                replacerThis;
            return {
                replacer: function(key, value) {
                    lastKey = key;
                    lastValue = value;
                    numCalls++;
                    replacerThis = this;
                    return value;
                },
                assert: function() {
                    assert.equal(numCalls, 1, "Replacer should be called exactly once for " + expectedValue);
                    assert.equal(lastKey, "");
                    assert.deepEqual(replacerThis, {"":expectedValue});
                    var expectedValueToJson = expectedValue;
                    if (expectedValue && expectedValue['toJSON']) {
                        expectedValueToJson = expectedValue.toJSON();
                    }
                    assert.equal(lastValue, expectedValueToJson);
                }
            }
        }
    }
    for (var i=0; i<simpleCases.length; i++) {
        assertStringify(simpleCases[i], replacerTestFactory(simpleCases[i]));
    }
};

exports.stringify.replacer.function.complexObject = function test() {
    var obj = {
        "": "emptyPropertyName",
        one: 'string',
        two: 123,
        three: ['array1', 'array2'],
        four: {nested_one:'anotherString'},
        five: new Date(),
        six: Date.now(),
        seven: null,
        eight: true,
        nine: false,
        ten: [NaN, Infinity, -Infinity],
        eleven: function() {}
    };
    var expectedKeys = [
        '', // top level object
        '', // First key
        'one',
        'two',
        'three', 0, 1, // array keys
        'four', 'nested_one', // nested object keys
        'five',
        'six',
        'seven',
        'eight',
        'nine',
        'ten', 0, 1, 2, // array keys
        'eleven'
    ];
    var expectedHolders = [
        {"": obj},
        obj,
        obj,
        obj,
        obj, obj.three, obj.three,
        obj, obj.four,
        obj,
        obj,
        obj,
        obj,
        obj,
        obj, obj.ten, obj.ten, obj.ten,
        obj
    ];
    var ReplacerTest = function() {
        var seenKeys = [];
        var seenHolders = [];
        return {
            replacer: function(key, value) {
                seenKeys.push(key);
                seenHolders.push(this);
                if (typeof(value) == "object") {
                    return value;
                }
                return 'replaced ' + (value ? value.toString() : '');
            },
            assert: function() {
                assert.deepEqual(seenKeys, expectedKeys);
                assert.deepEqual(seenHolders, expectedHolders);
            }
        }
    };
    assertStringify(obj, ReplacerTest);
};

exports.stringify.replacer.function.replacingWithUndefined = function test() {
    var obj = { shouldSurvive: 'one', shouldBeRemoved: 'two' };
    var ReplacerTest = function() {
        return {
            replacer: function(key, value) {
                if (key === 'shouldBeRemoved') {
                    return undefined;
                } else {
                    return value;
                }
            },
            assert: function() { /* no-op */ }
        }
    };
    assertStringify(obj, ReplacerTest);
};

exports.stringify.replacer.function.replacingArrayValueWithUndefined = function test() {
    var obj = ['should survive', 'should be removed'];
    var ReplacerTest = function() {
        return {
            replacer: function(key, value) {
                if (value === 'should be removed') {
                    return undefined;
                } else {
                    return value;
                }
            },
            assert: function() { /* no-op */ }
        }
    };
    assertStringify(obj, ReplacerTest);
};

exports.stringify.replacer.array = {};

exports.stringify.replacer.array.simple = function test() {
    var ReplacerTest = function() {
        return {
            replacer: [],
            assert: function() { /* no-op */ }
        }
    };
    for (var i=0; i<simpleCases.length; i++) {
        assertStringify(simpleCases[i], ReplacerTest);
    }
};

exports.stringify.replacer.array.emptyStringProperty = function test() {
    var obj = {'': 'keep', 'one': 'remove'};
    var ReplacerTest = function() {
        return {
            replacer: [''],
            assert: function() {/* no-op */}
        }
    };
    assertStringify(obj, ReplacerTest);
};

exports.stringify.replacer.array.complexObject = function test() {
    var obj = {
        "": "emptyPropertyName",
        one: 'string',
        one_remove: 'string',
        two: 123,
        two_remove: 123,
        three: ['array1', 'array2'],
        three_remove: ['array1', 'array2'],
        four: {nested_one:'anotherString', nested_one_remove: 'anotherString'},
        four_remove: {nested_one:'anotherString', nested_one_remove: 'anotherString'},
        five: new Date(),
        five_remove: new Date(),
        six: Date.now(),
        six_remove: Date.now(),
        seven: null,
        seven_remove: null,
        eight: true,
        eight_remove: true,
        nine: false,
        nine_remove: false,
        ten: [NaN, Infinity, -Infinity],
        ten_remove: [NaN, Infinity, -Infinity],
        eleven: function() {},
        eleven_remove: function() {}
    };
    var ReplacerTest = function() {
        return {
            replacer: [
                'one', 'two', 'three', 'four', 'nested_one', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 0
            ],
            assert: function() {/* no-op */}
        }
    };
    assertStringify(obj, ReplacerTest);
};

exports.stringify.toJSON = function test() {
    var customToJSONObject = {
        name: 'customToJSONObject',
        toJSON: function() {
            return 'custom-to-json-object-serialization';
        }
    };
    assertStringify(customToJSONObject);

    var customToJSONPrimitive = "Some string";
    customToJSONPrimitive.toJSON = function() {
        return 'custom-to-json-string-serialization';
    };
    assertStringify(customToJSONPrimitive);

    var object = {
        customToJSONObject: customToJSONObject
    };
    assertStringify(object);

    // Returning an object with a toJSON function does *NOT* have that toJSON function called: it is omitted
    var nested = {
        name: 'nested',
        toJSON: function() {
            return customToJSONObject;
        }
    };
    assertStringify(nested);

    var count = 0;
    function createObjectSerialisingTo(value) {
        count++;
        return {
            name: 'obj-' + count,
            toJSON: function() {
                return value;
            }
        };
    }
    assertStringify(createObjectSerialisingTo(null));
    assertStringify(createObjectSerialisingTo(undefined));
    assertStringify(createObjectSerialisingTo([]));
    assertStringify(createObjectSerialisingTo({}));
    assertStringify(createObjectSerialisingTo(12345));
    assertStringify(createObjectSerialisingTo(true));
    assertStringify(createObjectSerialisingTo(new Date()));
    assertStringify(createObjectSerialisingTo(function(){}));
};

function stringifyJSON5(obj, replacer, space) {
    var start, res, end;
    try {
        start = new Date();
        res = JSON5.stringify(obj, replacer, space);
        end = new Date();
    } catch (e) {
        res = e.message;
        end = new Date();
    }
    if (DEBUG) {
        console.log('JSON5.stringify time: ' + (end-start));
        console.log(res);
    }
    return res;
}

function stringifyJSON(obj, replacer, space) {
    var start, res, end;
    
    try {
        start = new Date();
        res = JSON.stringify(obj, replacer, space);
        end = new Date();
    
        // now remove all quotes from keys where appropriate
        // first recursively find all key names
        var keys = [];
        function findKeys(key, innerObj) {
            if (innerObj && innerObj.toJSON && typeof innerObj.toJSON === "function") {
                innerObj = innerObj.toJSON();
            }
            if (replacer) {
                if (typeof replacer === 'function') {
                    innerObj = replacer(key, innerObj);
                } else if (key !== '' && replacer.indexOf(key) < 0) {
                    return;
                }
            }
            if (JSON5.isWord(key) &&
                typeof innerObj !== 'function' &&
                typeof innerObj !== 'undefined') {
                keys.push(key);
            }
            if (typeof innerObj === 'object') {
                if (Array.isArray(innerObj)) {
                    for (var i = 0; i < innerObj.length; i++) {
                        findKeys(i, innerObj[i]);
                    }
                } else if (innerObj !== null) {
                    for (var prop in innerObj) {
                        if (innerObj.hasOwnProperty(prop)) {
                            findKeys(prop, innerObj[prop]);
                        }
                    }
                }
            }
        }
        findKeys('', obj);

        // now replace each key in the result
        var last = 0;
        for (var i = 0; i < keys.length; i++) {
        
            // not perfect since we can match on parts of the previous value that 
            // matches the key, but we can design our test around that.
            last = res.indexOf('"' + keys[i] + '"', last);
            if (last === -1) {
                // problem with test framework
                console.log("Couldn't find: " + keys[i]);
                throw new Error("Couldn't find: " + keys[i]);
            }
            res = res.substring(0, last) + 
                res.substring(last+1, last + keys[i].length+1) + 
                res.substring(last + keys[i].length + 2, res.length);
            last += keys[i].length;
        }
    } catch (e) {
        res = e.message;
        end = new Date();
    }
    if (DEBUG) {
        console.log('JSON.stringify time: ' + (end-start));
    }
    return res;
}

function assertStringify(obj, replacerTestConstructor, expectError) {
    if (!replacerTestConstructor) {
        replacerTestConstructor = function(){
            return {replacer: null, assert: function(){}};
        };
    }
    var testStringsEqual = function(obj, indent) {
        var j5ReplacerTest = replacerTestConstructor();
        var jReplacerTest = replacerTestConstructor();
        var j5, j;
        j5 = stringifyJSON5(obj, j5ReplacerTest.replacer, indent);
        j = stringifyJSON(obj, jReplacerTest.replacer, indent);
        assert.equal(j5, j);
        j5ReplacerTest.assert();
    };

    var indents = [
        undefined,
        " ",
        "          ",
        "                    ",
        "\t",
        "this is an odd indent",
        5,
        20,
        '\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t'
    ];
    for (var i=0; i<indents.length; i++) {
        testStringsEqual(obj, indents[i]);
    }

    if (!expectError) {
        // no point in round tripping if there is an error
        var origStr = JSON5.stringify(obj), roundTripStr;
        if (origStr !== "undefined" && typeof origStr !== "undefined") {
            try {
                roundTripStr = JSON5.stringify(JSON5.parse(origStr));
            } catch (e) {
                console.log(e);
                console.log(origStr);    
                throw e;
            }
            assert.equal(origStr, roundTripStr);
        }
    }
}