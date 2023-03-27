
import React from 'react';

import {FormattedMessage} from 'react-intl';

export const PAST_TIME_SPEC = [
    {within: ['second', -45], display: <FormattedMessage defaultMessage='just now'/>},
    ['minute', -59],
    ['hour', -48],
    ['day', -30],
    ['month', -12],
    'year',
];

export const FUTURE_TIME_SPEC = [
    ['minute', 59],
    ['hour', 48],
    ['day', 30],
    ['month', 12],
    'year',
];
