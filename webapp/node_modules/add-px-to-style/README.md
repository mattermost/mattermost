# add-px-to-style

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

Will add px to the end of style values which are Numbers. The following style properties will not have px added.

- animationIterationCount
- boxFlex
- boxFlexGroup
- boxOrdinalGroup
- columnCount
- fillOpacity
- flex
- flexGrow
- flexPositive
- flexShrink
- flexNegative
- flexOrder
- gridRow
- gridColumn
- fontWeight
- lineClamp
- lineHeight
- opacity
- order
- orphans
- stopOpacity
- strokeDashoffset
- strokeOpacity
- strokeWidth
- tabSize
- widows
- zIndex
- zoom

## Usage
```
var addPxToStyle = require('add-px-to-style');

addPxToStyle('top', 22); // '22px'
addPxToStyle('zIndex', 3); // 3
```

[![NPM](https://nodei.co/npm/add-px-to-style.png)](https://www.npmjs.com/package/add-px-to-style)

## License

MIT, see [LICENSE.md](http://github.com/mikkoh/add-px-to-style/blob/master/LICENSE.md) for details.
