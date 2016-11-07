var render = require('../helper/render');
var ruleset = require('../helper/ruleset');

describe("CSS3 Box Shadow", function () {

  it("should generate a default box shadow", function (done) {
    render(ruleset('$default-box-shadow-inset: inset !global; $default-box-shadow-h-offset: 23px !global; $default-box-shadow-v-offset: 24px !global; $default-box-shadow-blur: 17px !global; $default-box-shadow-spread: 15px  !global; $default-box-shadow-color: #DEADBE  !global; $experimental-support-for-mozilla: false  !global; $experimental-support-for-opera: false  !global; @include box-shadow'), function(output, err) {
      expect(output).toBe(ruleset('-webkit-box-shadow:inset 23px 24px 17px 15px #DEADBE;box-shadow:inset 23px 24px 17px 15px #DEADBE'));
      done();
    }, ['compass/css3/box-shadow']);
  });

});
