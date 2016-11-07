/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

// This is a "hack" until a proper `intl-pluralformat` package is created.

import IntlMessageFormat from 'intl-messageformat';

function resolveLocale(locales) {
    // IntlMessageFormat#_resolveLocale() does not depend on `this`.
    return IntlMessageFormat.prototype._resolveLocale(locales);
}

function findPluralFunction(locale) {
    // IntlMessageFormat#_findPluralFunction() does not depend on `this`.
    return IntlMessageFormat.prototype._findPluralRuleFunction(locale);
}

export default class IntlPluralFormat {
    constructor(locales, options = {}) {
        let useOrdinal = options.style === 'ordinal';
        let pluralFn   = findPluralFunction(resolveLocale(locales));

        this.format = (value) => pluralFn(value, useOrdinal);
    }
}
