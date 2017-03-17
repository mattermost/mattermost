/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import {PropTypes} from 'react';

const {bool, number, string, func, object, oneOf, shape} = PropTypes;

export const intlConfigPropTypes = {
    locale  : string,
    formats : object,
    messages: object,

    defaultLocale : string,
    defaultFormats: object,
};

export const intlFormatPropTypes = {
    formatDate       : func.isRequired,
    formatTime       : func.isRequired,
    formatRelative   : func.isRequired,
    formatNumber     : func.isRequired,
    formatPlural     : func.isRequired,
    formatMessage    : func.isRequired,
    formatHTMLMessage: func.isRequired,
};

export const intlShape = shape({
    ...intlConfigPropTypes,
    ...intlFormatPropTypes,
    formatters: object,
    now: func.isRequired,
});

export const messageDescriptorPropTypes = {
    id            : string.isRequired,
    description   : string,
    defaultMessage: string,
};

export const dateTimeFormatPropTypes = {
    localeMatcher: oneOf(['best fit', 'lookup']),
    formatMatcher: oneOf(['basic', 'best fit']),

    timeZone: string,
    hour12  : bool,

    weekday     : oneOf(['narrow', 'short', 'long']),
    era         : oneOf(['narrow', 'short', 'long']),
    year        : oneOf(['numeric', '2-digit']),
    month       : oneOf(['numeric', '2-digit', 'narrow', 'short', 'long']),
    day         : oneOf(['numeric', '2-digit']),
    hour        : oneOf(['numeric', '2-digit']),
    minute      : oneOf(['numeric', '2-digit']),
    second      : oneOf(['numeric', '2-digit']),
    timeZoneName: oneOf(['short', 'long']),
};

export const numberFormatPropTypes = {
    localeMatcher: oneOf(['best fit', 'lookup']),

    style          : oneOf(['decimal', 'currency', 'percent']),
    currency       : string,
    currencyDisplay: oneOf(['symbol', 'code', 'name']),
    useGrouping    : bool,

    minimumIntegerDigits    : number,
    minimumFractionDigits   : number,
    maximumFractionDigits   : number,
    minimumSignificantDigits: number,
    maximumSignificantDigits: number,
};

export const relativeFormatPropTypes = {
    style: oneOf(['best fit', 'numeric']),
    units: oneOf(['second', 'minute', 'hour', 'day', 'month', 'year']),
};

export const pluralFormatPropTypes = {
    style: oneOf(['cardinal', 'ordinal']),
};
