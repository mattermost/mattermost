var render = require('../helper/render');
var ruleset = require('../helper/ruleset');

describe("CSS3 Transition", function () {

  it("should generate a transition", function (done) {
    render(ruleset('$experimental-support-for-mozilla: false !global; $experimental-support-for-opera: false !global; @include transition(ok 0s);'), function(output, err) {
      expect(output).toBe(ruleset('-webkit-transition:ok 0s;transition:ok 0s'));
      done();
    }, ['compass/css3/transition']);
  });

});
