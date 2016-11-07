var flatten = require('./index'),
    util = require('util'),
    assert = require('assert');

[
  [ [1, [ 2, 3]], [1, [2, 3]], 0],
  [ [1, 2, 3 ], [1, 2, 3] ],
  [ ['a', ['b', ['c']]], ['a', 'b', 'c'] ],
  [ [2, [4, 6], 8, [[10]]], [2, 4, 6, 8, 10] ],
  [ [1, [2, [3, [4, [5]]]]], [1, 2, 3, [4, [5]]], 2 ] // depth of 2
].forEach(function (t) {
  assert.deepEqual(flatten(t[0], t[2]), t[1], 
    util.format('☠☠☠☠☠☠☠☠☠ %s ☠☠☠☠☠☠☠☠☠', formatCall(t))
  );
  console.log('✓ %s', formatCall(t));
});

function formatCall(t) {
  if (typeof t[2] === 'undefined') {
    return util.format('`flatten(%j) == %j`', t[0], t[1]);
  }
  else {
    return util.format('`flatten(%j, %j) == %j`', t[0], t[2], t[1]);
  }
}
