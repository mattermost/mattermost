Intl MessageFormat Parser
=========================

Parses [ICU Message strings][ICU] into an AST via JavaScript.

[![npm Version][npm-badge]][npm]
[![Build Status][travis-badge]][travis]
[![Dependency Status][david-badge]][david]


Overview
--------

This package implements a parser in JavaScript that parses the industry standard [ICU Message strings][ICU] — used for internationalization — into an AST. The produced AST can then be used by a compiler, like [`intl-messageformat`][intl-mf], to produce localized formatted strings for display to users.

This parser is written in [PEG.js][], a parser generator for JavaScript. This parser's implementation was inspired by and derived from Alex Sexton's [messageformat.js][] project. The differences from Alex's implementation are:

- This project is standalone.
- It's authored as ES6 modules compiled to CommonJS and the Bundle format for the browser.
- The produced AST is more descriptive and uses recursive structures.
- The keywords used in the AST match the ICU Message "spec".


Usage
-----

### Loading in the Browser

The `dist/` folder contains the version of this package for use in the browser, and it can be loaded and used like this:

```html
<script src="intl-messageformat-parser/dist/parser.min.js"></script>
<script>
    IntlMessageFormatParser.parse('...');
</script>
```

### Loading in Node.js

This package can also be `require()`-ed in Node.js:

```js
var parser = require('intl-messageformat-parser');
parser.parse('...');
```

### Example

Given an ICU Message string like this:

```
On {takenDate, date, short} {name} took {numPhotos, plural,
    =0 {no photos.}
    =1 {one photo.}
    other {# photos.}
}
```

```js
// Assume `msg` is the string above.
parser.parse(msg);
```

This parser will produce this AST:

```json
{
    "type": "messageFormatPattern",
    "elements": [
        {
            "type": "messageTextElement",
            "value": "On "
        },
        {
            "type": "argumentElement",
            "id": "takenDate",
            "format": {
                "type": "dateFormat",
                "style": "short"
            }
        },
        {
            "type": "messageTextElement",
            "value": " "
        },
        {
            "type": "argumentElement",
            "id": "name",
            "format": null
        },
        {
            "type": "messageTextElement",
            "value": " took "
        },
        {
            "type": "argumentElement",
            "id": "numPhotos",
            "format": {
                "type": "pluralFormat",
                "offset": 0,
                "options": [
                    {
                        "type": "optionalFormatPattern",
                        "selector": "=0",
                        "value": {
                            "type": "messageFormatPattern",
                            "elements": [
                                {
                                    "type": "messageTextElement",
                                    "value": "no photos."
                                }
                            ]
                        }
                    },
                    {
                        "type": "optionalFormatPattern",
                        "selector": "=1",
                        "value": {
                            "type": "messageFormatPattern",
                            "elements": [
                                {
                                    "type": "messageTextElement",
                                    "value": "one photo."
                                }
                            ]
                        }
                    },
                    {
                        "type": "optionalFormatPattern",
                        "selector": "other",
                        "value": {
                            "type": "messageFormatPattern",
                            "elements": [
                                {
                                    "type": "messageTextElement",
                                    "value": "# photos."
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ]
}
```


License
-------

This software is free to use under the Yahoo! Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.


[npm]: https://www.npmjs.org/package/intl-messageformat-parser
[npm-badge]: https://img.shields.io/npm/v/intl-messageformat-parser.svg?style=flat-square
[david]: https://david-dm.org/yahoo/intl-messageformat-parser
[david-badge]: https://img.shields.io/david/yahoo/intl-messageformat-parser.svg?style=flat-square
[travis]: https://travis-ci.org/yahoo/intl-messageformat-parser
[travis-badge]: https://img.shields.io/travis/yahoo/intl-messageformat-parser.svg?style=flat-square
[ICU]: http://userguide.icu-project.org/formatparse/messages
[intl-mf]: https://github.com/yahoo/intl-messageformat
[PEG.js]: http://pegjs.majda.cz
[messageformat.js]: https://github.com/SlexAxton/messageformat.js
[LICENSE file]: https://github.com/yahoo/intl-messageformat-parser/blob/master/LICENSE
