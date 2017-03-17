React Intl
==========

Internationalize [React][] apps. This library provides React components and an API to format dates, numbers, and strings, including pluralization and handling translations.

[![npm Version][npm-badge]][npm]
[![Build Status][travis-badge]][travis]
[![Dependency Status][david-badge]][david]

Overview
--------

**React Intl is part of [FormatJS][].** It provides bindings to React via its components and API.

### [Documentation][]

React Intl's docs are in this GitHub repo's [Wiki][Documentation], [__Get Started__][Getting Started]. There are also several [runnable example apps][Examples] which you can reference to learn how all the pieces fit together.

_(If you're looking for React Intl v1, you can find it [here][v1-docs].)_

### Features

- Display numbers with separators.
- Display dates and times correctly.
- Display dates relative to "now".
- Pluralize labels in strings.
- Support for 150+ languages.
- Runs in the browser and Node.js.
- Built on standards.

### Example

There are several [runnable examples][Examples] in this Git repo, but here's a Hello World one:

```js
import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {IntlProvider, FormattedMessage} from 'react-intl';

class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            name       : 'Eric',
            unreadCount: 1000,
        };
    }

    render() {
        const {name, unreadCount} = this.state;

        return (
            <p>
                <FormattedMessage
                    id="welcome"
                    defaultMessage={`Hello {name}, you have {unreadCount, number} {unreadCount, plural,
                      one {message}
                      other {messages}
                    }`}
                    values={{name: <b>{name}</b>, unreadCount}}
                />
            </p>
        );
    }
}

ReactDOM.render(
    <IntlProvider locale="en">
        <App />
    </IntlProvider>,
    document.getElementById('container')
);

```

This example would render: "Hello **Eric**, you have 1,000 messages." into the container element on the page.

**Pluralization rules:** In some languages you have more than `one` and `other`. For example in `ru` there are the following plural rules: `one`, `few`, `many` and `other`.
Check out the official [Unicode CLDR documentation](http://www.unicode.org/cldr/charts/28/supplemental/language_plural_rules.html).

Contribute
---------

Let's make React Intl and FormatJS better! If you're interested in helping, all contributions are welcome and appreciated. React Intl is just one of many packages that make up the [FormatJS suite of packages][FormatJS GitHub], and you can contribute to any/all of them, including the [Format JS website][FormatJS] itself.

Check out the [Contributing document][CONTRIBUTING] for the details. Thanks!


License
-------

This software is free to use under the Yahoo Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.


[npm]: https://www.npmjs.org/package/react-intl
[npm-badge]: https://img.shields.io/npm/v/react-intl.svg?style=flat-square
[david]: https://david-dm.org/yahoo/react-intl
[david-badge]: https://img.shields.io/david/yahoo/react-intl.svg?style=flat-square
[travis]: https://travis-ci.org/yahoo/react-intl
[travis-badge]: https://img.shields.io/travis/yahoo/react-intl/master.svg?style=flat-square
[React]: http://facebook.github.io/react/
[FormatJS]: http://formatjs.io/
[FormatJS GitHub]: http://formatjs.io/github/
[Documentation]: https://github.com/yahoo/react-intl/wiki
[Getting Started]: https://github.com/yahoo/react-intl/wiki#getting-started
[Examples]: https://github.com/yahoo/react-intl/tree/master/examples
[v1-docs]: http://formatjs.io/react/v1/
[CONTRIBUTING]: https://github.com/yahoo/react-intl/blob/master/CONTRIBUTING.md
[LICENSE file]: https://github.com/yahoo/react-intl/blob/master/LICENSE.md
