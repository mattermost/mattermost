// require.js
// Tests JSON5's require() hook.
//
// Important: expects the following test cases to be present:
// - /parse-cases/misc/npm-package.json
// - /parse-cases/misc/npm-package.json5

var assert = require('assert');

exports['misc'] = {};
exports['misc']['require hook'] = function () {
    require('../lib/require');

    var json = require('./parse-cases/misc/npm-package.json');
    var json5 = require('./parse-cases/misc/npm-package.json5');

    assert.deepEqual(json5, json);
};
