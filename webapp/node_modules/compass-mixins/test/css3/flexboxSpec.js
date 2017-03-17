var compareIt = require('../helper/compare');

describe("Flexbox", function() {
  var flexShould = function(spec, ruleset, output) {
    return compareIt("should " + spec, ruleset, output,
                     ['compass/css3/flexbox']);
  };

  compareIt("should output all flexbox properties",
            "@include flexbox(( display: flex, flex-direction: row-reverse, flex-wrap: wrap-reverse, flex-flow: row-reverse wrap-reverse, order: 1, flex: 1 0 auto, flex-grow: 1, flex-shrink: 0, flex-basis: auto, justify-content: flex-start, align-items: flex-start, align-self: flex-start, align-content: flex-start));",
            "display:-webkit-flex;display:flex;-webkit-flex-direction:row-reverse;flex-direction:row-reverse;-webkit-flex-wrap:wrap-reverse;flex-wrap:wrap-reverse;-webkit-flex-flow:row-reverse wrap-reverse;flex-flow:row-reverse wrap-reverse;-webkit-order:1;order:1;-webkit-flex:1 0 auto;flex:1 0 auto;-webkit-flex-grow:1;flex-grow:1;-webkit-flex-shrink:0;flex-shrink:0;-webkit-flex-basis:auto;flex-basis:auto;-webkit-justify-content:flex-start;justify-content:flex-start;-webkit-align-items:flex-start;align-items:flex-start;-webkit-align-self:flex-start;align-self:flex-start;-webkit-align-content:flex-start;align-content:flex-start",
            ['compass/css3/flexbox']);
});
