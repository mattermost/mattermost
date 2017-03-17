# flatten

A tiny utility to flatten arrays of arrays (of arrays, etc., recursively, infinitely or to an optional depth) into a single array of non-arrays.

## example:

```js
> var flatten = require('flatten');
undefined
> flatten([1, [2, 3], [4, 5, 6], [7, [8, 9]], 10])
[ 1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10 ]
> flatten([1, [2, [3, [4, [5]]]]], 2)
[ 1,
  2,
  3,
  [ 4, [ 5 ] ] ]
```

## install:

    npm install flatten

## license:

MIT/X11.
