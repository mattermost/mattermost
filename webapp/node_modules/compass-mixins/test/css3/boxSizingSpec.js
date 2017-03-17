var render = require('../helper/render');
var ruleset = require('../helper/ruleset');

describe("CSS3 Boz Sizing", function () {

  describe("CSS3 an argument", function () {

    it("should generate a box-size property", function (done) {
      render(ruleset('$experimental-support-for-mozilla: false  !global; $experimental-support-for-opera: false  !global; @include box-sizing(border-box)'), function(output, err) {
        expect(output).toBe(ruleset('-webkit-box-sizing:border-box;box-sizing:border-box'));
        done();
      }, ['compass/css3/box-sizing']);
    });

  });

  describe("CSS3 an empty argument", function () {
    describe("in a ruleset without other properties", function () {
      it("should generate nothing", function (done) {
        render(ruleset('$experimental-support-for-mozilla: false  !global; $experimental-support-for-opera: false  !global; @include box-sizing("")'), function(output, err) {
          expect(output).toBe('');
          done();
        }, ['compass/css3/box-sizing']);
      });
    });

    describe("in a ruleset with other properties", function () {
      it("should generate the other properties", function (done) {
        render(ruleset('$experimental-support-for-mozilla: false  !global; $experimental-support-for-opera: false  !global; foo: bar; @include box-sizing("")'), function(output, err) {
          expect(output).toBe(ruleset('foo:bar'));
          done();
        }, ['compass/css3/box-sizing']);
      });
    });
  });

});
