var convert = require("../index");

var converter = convert();

var times = 10000;

console.time("cached");
converter.rgb(10, 2, 30);
for(var i = 0; i < times; i++) {
   converter.hsv();
   converter.hsl();
   converter.cmyk();
}
console.timeEnd("cached");

console.time("uncached");
for(var i = 0; i < times; i++) {
   convert.rgb2hsl(10, 2, 30);
   convert.rgb2hsv(10, 2, 30);
   convert.rgb2cmyk(10, 2, 30);
}
console.timeEnd("uncached");

