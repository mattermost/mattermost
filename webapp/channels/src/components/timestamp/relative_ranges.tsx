// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {RangeDescriptor} from './timestamp';

export const TODAY_YESTERDAY: RangeDescriptor = {
    within: ['day', -1],
    display: ['day'],
};

export const TODAY_TITLE_CASE: RangeDescriptor = {
    equals: ['day', 0],
    display: (
        <FormattedMessage
            id='date_separator.today'
            defaultMessage='Today'
        />
    ),
};

export const YESTERDAY_TITLE_CASE: RangeDescriptor = {
    equals: ['day', -1],
    display: (
        <FormattedMessage
            id='date_separator.yesterday'
            defaultMessage='Yesterday'
        />
    ),
};

export const TOMORROW_TITLE_CASE: RangeDescriptor = {
    equals: ['day', 1],
    display: (
        <FormattedMessage
            id='date_separator.tomorrow'
            defaultMessage='Tomorrow'
        />
    ),
};

export const STANDARD_UNITS: {[key: string]: RangeDescriptor} = {
    now: {within: ['second', -45], display: ['second', 0]},
    second: {within: ['second', -59], display: ['second']},
    minute: {within: ['minute', -59], display: ['minute']},
    hour: {within: ['hour', -23.75], display: ['hour']},
    'today-yesterday': TODAY_YESTERDAY,
    Today: TODAY_TITLE_CASE,
    Yesterday: YESTERDAY_TITLE_CASE,
    day: {within: ['day', -6], display: ['day']},
    week: {within: ['week', -3], display: ['week']},
    month: {within: ['month', -11], display: ['month']},
    quarter: {within: ['quarter', -3], display: ['quarter']},
    year: {within: ['year', -1000], display: ['year']},
};
