(function() {
  var brackets, last;

  last = function(array) {
    return array[array.length - 1];
  };

  brackets = {
    parse: function(str) {
      var current, j, len, stack, sym;
      current = [''];
      stack = [current];
      for (j = 0, len = str.length; j < len; j++) {
        sym = str[j];
        if (sym === '(') {
          current = [''];
          last(stack).push(current);
          stack.push(current);
        } else if (sym === ')') {
          stack.pop();
          current = last(stack);
          current.push('');
        } else {
          current[current.length - 1] += sym;
        }
      }
      return stack[0];
    },
    stringify: function(ast) {
      var i, j, len, result;
      result = '';
      for (j = 0, len = ast.length; j < len; j++) {
        i = ast[j];
        if (typeof i === 'object') {
          result += '(' + brackets.stringify(i) + ')';
        } else {
          result += i;
        }
      }
      return result;
    }
  };

  module.exports = brackets;

}).call(this);
