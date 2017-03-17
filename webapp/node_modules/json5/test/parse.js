// parse.js
// Tests parse(). See readme.txt for details.

var assert = require('assert');
var FS = require('fs');
var JSON5 = require('..');
var Path = require('path');

// Test JSON5.parse() by comparing its output for each case with either the
// native JSON.parse() or ES5 strict-mode eval(). See readme.txt for details.
// For eval(), remember to wrap the input in parentheses before eval()'ing,
// since {...} is ambiguous in JavaScript. Also ensure the parentheses are on
// lines of their own, to support inline comments.

// TODO More test cases, and ones that test specific features and edge cases.
// Mozilla's test cases are a great inspiration and reference here:
// http://mxr.mozilla.org/mozilla-central/source/js/src/tests/ecma_5/JSON/

var dirsPath = Path.resolve(__dirname, 'parse-cases');
var dirs = FS.readdirSync(dirsPath);

function createTest(fileName, dir) {
    var ext = Path.extname(fileName);
    var filePath = Path.join(dirsPath, dir, fileName);
    var str = FS.readFileSync(filePath, 'utf8');

    function parseJSON5() {
        return JSON5.parse(str);
    }

    function parseJSON() {
        return JSON.parse(str);
    }

    function parseES5() {
        return eval('"use strict"; (\n' + str + '\n)');
    }

    exports[dir][fileName] = function test() {
        switch (ext) {
            case '.json':
                assert.deepEqual(parseJSON5(), parseJSON(),
                    'Expected parsed JSON5 to equal parsed JSON.');
                break;
            case '.json5':
                assert.throws(parseJSON,        // test validation
                    'Test case bug: expected JSON parsing to fail.');
                // Need special case for NaN as NaN != NaN
                if ( fileName === 'nan.json5' ) {
                  assert.equal( isNaN( parseJSON5() ), isNaN( parseES5() ),
                    'Expected parsed JSON5 to equal parsed ES5.');
                }
                else {
                  assert.deepEqual( parseJSON5(), parseES5(),
                    'Expected parsed JSON5 to equal parsed ES5.');
                }
                break;
            case '.js':
                assert.throws(parseJSON,        // test validation
                    'Test case bug: expected JSON parsing to fail.');
                assert.doesNotThrow(parseES5,   // test validation
                    'Test case bug: expected ES5 parsing not to fail.');
                assert.throws(parseJSON5,
                    'Expected JSON5 parsing to fail.');
                break;
            case '.txt':
                assert.throws(parseES5,         // test validation
                    'Test case bug: expected ES5 parsing to fail.');
                assert.throws(parseJSON5,
                    'Expected JSON5 parsing to fail.');
                break;
        }
    };
}

dirs.forEach(function (dir) {
    // create a test suite for this group of tests:
    exports[dir] = {};

    // skip the TODO directory -- these tests are expected to fail:
    if (dir === 'todo') {
        return;
    }

    // otherwise create a test for each file in this group:
    FS.readdirSync(Path.join(dirsPath, dir)).forEach(function (file) {
        createTest(file, dir);
    });
});
