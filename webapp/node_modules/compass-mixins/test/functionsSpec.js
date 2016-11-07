var render = require('./helper/render');
var property = require('./helper/property');

describe("List Functions", function () {

  // This is verifying a function that's part of libsass that Compass also provided.
  it("should compact a list with false values", function (done) {
    render(property('compact(one,false,three)'), function(output, err) {
      expect(output).toBe(property('one,three'));
      done();
    });
  });

  it("should calculate a list length", function(done) {
    render('$list: one, two;' + property('-compass-list-size($list)'), function(output, err) {
      expect(output).toBe(property('2'));
      done();
    });
  });

  it("should calculate a list length with a space delimiter", function(done) {
    render('$list: one two;' + property('-compass-list-size($list)'), function(output, err) {
      expect(output).toBe(property('2'));
      done();
    });
  });

  it("should slice a list", function(done) {
    render('$list: one, two, three, four;' + property('-compass-slice($list, 2, 3)'), function(output, err) {
      expect(output).toBe(property('two,three'));
      done();
    });
  });

  it("should slice a list to the end", function(done) {
    render('$list: one, two, three, four;' + property('-compass-slice($list, 2)'), function(output, err) {
      expect(output).toBe(property('two,three,four'));
      done();
    });
  });

  it("should reject values from a list", function(done) {
    render('$list: one, two, three, four;' + property('reject($list, two, four)'), function(output, err) {
      expect(output).toBe(property('one,three'));
      done();
    });
  });

  it("should get the first value of a list", function(done) {
    render('$list: one, two, three, four;' + property('first-value-of($list)'), function(output, err) {
      expect(output).toBe(property('one'));
      done();
    });
  });

  it("should create a space-delimited list", function(done) {
    render(property('-compass-space-list(a, b, c)'), function(output, err) {
      expect(output).toBe(property('a b c'));
      done();
    });
  });

});

describe("Cross Browser Functions", function () {

  it("should prefix a property", function(done) {
    render(property('prefix(-webkit, x)'), function(output, err) {
      expect(output).toBe(property('-webkit-x'));
      done();
    });
  });

  it("should prefix a list of properties", function(done) {
    render(property('prefix(-webkit, x, y, z)'), function(output, err) {
      expect(output).toBe(property('-webkit-x,-webkit-y,-webkit-z'));
      done();
    });
  });

  it("should prefix a list of complex properties", function(done) {
    render(property('prefix(-webkit, linear-gradient(-45deg, rgb(0,0,0) 25%, transparent 75%, transparent), linear-gradient(-45deg, #000 25%, transparent 75%, transparent))'), function(output, err) {
      expect(output).toBe(property('-webkit-linear-gradient(-45deg, #000 25%, transparent 75%, transparent),-webkit-linear-gradient(-45deg, #000 25%, transparent 75%, transparent)'));
      done();
    });
  });

  it("should prefix a list of properties as a single argument", function(done) {
    render('$list: x, y, z;' + property('prefix(-webkit, $list)'), function(output, err) {
      expect(output).toBe(property('-webkit-x,-webkit-y,-webkit-z'));
      done();
    });
  });

  it("should prefix a property with a browser function", function(done){
    render(property('-webkit(x)'), function(output, err) {
      expect(output).toBe(property('-webkit-x'));
      done();
    });
  });

  it("should prefix a list of properties with a browser function", function(done) {
    render(property('-webkit(x, y, z)'), function(output, err) {
      expect(output).toBe(property('-webkit-x,-webkit-y,-webkit-z'));
      done();
    });
  });

  it("should prefix a list of properties with a browser function as a single argument", function(done) {
    render('$list: x, y, z;' + property('-webkit($list)'), function(output, err) {
      expect(output).toBe(property('-webkit-x,-webkit-y,-webkit-z'));
      done();
    });
  });

  it("should not prefix numbers or colors", function(done){
    render(property('prefixed(-ok, rgb(0,0,0))')+property('prefixed(-ok, url(1.gif))')+property('prefixed(-ok, ok)'), function(output, err) {
      expect(output).toBe(property('false')+property('false')+property('true'));
      done();
    });
  });

});

describe("Gradient Functions", function () {

  it("should prefix a list with color stops", function(done) {
    render(property('prefix(-webkit, linear-gradient(-45deg, color-stops(rgb(0,0,0) 25%, transparent 75%, transparent)), linear-gradient(-45deg, color-stops(#000 25%, transparent 75%, transparent)))'), function(output, err) {
      expect(output).toBe(property('-webkit-linear-gradient(-45deg, #000 25%,transparent 75%,transparent),-webkit-linear-gradient(-45deg, #000 25%,transparent 75%,transparent)'));
      done();
    });
  });

});