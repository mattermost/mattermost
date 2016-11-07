var render = require('../helper/render');
var ruleset = require('../helper/ruleset');

describe("CSS3 Border Radius", function () {

  it("should generate a border radius", function (done) {
    render(ruleset('$experimental-support-for-mozilla: false !global; $experimental-support-for-opera: false !global; @include border-radius(0, 0)'), function(output, err) {
      expect(output).toBe(ruleset('-webkit-border-radius:0 0;border-radius:0 / 0'));
      done();
    }, ['compass/css3/border-radius']);
  });

});
