var render = require('../helper/render');
var ruleset = require('../helper/ruleset');

module.exports = function(spec, inputRuleset, expectedOutput, imports) {
  return it(spec, function (done) {
    render(ruleset(inputRuleset), function(output, err) {
      expect(output).toBe(ruleset(expectedOutput));
      done();
    }, imports);
  });
};
