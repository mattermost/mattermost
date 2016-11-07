(function() {
  module.exports = function(prefix) {
    var spec;
    spec = prefix === '-webkit- 2009' || prefix === '-moz-' ? 2009 : prefix === '-ms-' ? 2012 : prefix === '-webkit-' ? 'final' : void 0;
    if (prefix === '-webkit- 2009') {
      prefix = '-webkit-';
    }
    return [spec, prefix];
  };

}).call(this);
