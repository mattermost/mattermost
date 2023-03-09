// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    DateTime,
    Duration,
    DurationUnit,
    Interval,
} from 'luxon';
import React from 'react';

import {useNow} from 'src/hooks';

/** See {@link Intl.RelativeTimeFormatStyle} */
type FormatStyle = Intl.NumberFormatOptions['unitDisplay'];

type TruncateBehavior = 'none' | 'truncate';

interface DurationProps {
    from: number | DateTime;

    /**
     * @default 0 - refers to now
     */
    to?: 0 | number | DateTime;
    style?: FormatStyle;
    truncate?: TruncateBehavior;
}

const label = (num: number, style: FormatStyle, narrow: string, singular: string, plural: string) => {
    if (style === 'narrow') {
        return narrow;
    }

    return num >= 2 ? plural : singular;
};

const UNITS: DurationUnit[] = ['years', 'days', 'hours', 'minutes'];

export const formatDuration = (value: Duration, style: FormatStyle = 'narrow', truncate: TruncateBehavior = 'none') => {
    if (value.as('seconds') < 60) {
        return value
            .shiftTo('seconds')
            .mapUnits(Math.floor)
            .toHuman({unitDisplay: style});
    }

    const duration = value.shiftTo(...UNITS).normalize();
    const formatUnits = truncate === 'truncate' ? [UNITS.find((unit) => duration.get(unit) > 0)!] : UNITS.filter((unit) => duration.get(unit) > 0);

    return duration
        .shiftTo(...formatUnits)
        .mapUnits(Math.floor)
        .toHuman({unitDisplay: style});
};

const FormattedDuration = ({from, to = 0, style, truncate}: DurationProps) => {
    const now = useNow();

    if (!from) {
        // eslint-disable-next-line formatjs/no-literal-string-in-jsx
        return <div className='time'>{'-'}</div>;
    }

    const start = typeof from === 'number' ? DateTime.fromMillis(from) : from;
    const end = typeof to === 'number' ? DateTime.fromMillis(to || now.valueOf()) : to;
    const duration = Interval.fromDateTimes(start, end).toDuration(['years', 'days', 'hours', 'minutes']);
    return (
        <div className='time'>{formatDuration(duration, style, truncate)}</div>
    );
};

export default FormattedDuration;
