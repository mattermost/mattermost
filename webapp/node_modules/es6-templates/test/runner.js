/**
 * We pull in example files from test/examples/*.js. Write your assertions in
 * the file alongside the ES6 class "setup" code. The node `assert` library
 * will already be in the context.
 */

Error.stackTraceLimit = 20;

var compile = require('../lib').compile;
var fs = require('fs');
var path = require('path');
var RESULTS = 'test/results';

if (!fs.existsSync(RESULTS)) {
  fs.mkdirSync(RESULTS);
}

require('example-runner').runCLI(function(source, testName, filename) {
  var result = compile(source, {
    includeRuntime: true,
    sourceFileName: filename,
    sourceMapName: filename + '.map'
  });
  fs.writeFileSync(path.join(RESULTS, testName + '.js'), result.code, 'utf8');
  fs.writeFileSync(path.join(RESULTS, testName + '.js.map'), JSON.stringify(result.map), 'utf8');
  return result.code;
});
