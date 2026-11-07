// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
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

const UNITS: DurationUnit[] = ['years', 'days', 'hours', 'minutes'];

export const formatDuration = (value: Duration, style: FormatStyle = 'narrow', truncate: TruncateBehavior = 'none') => {
    let localValue = value;

    const isNegative = value.toMillis() < 0;
    if (isNegative) {
        localValue = value.negate();
    }

    if (localValue.as('seconds') < 60) {
        const str = localValue
            .shiftTo('seconds')
            .mapUnits(Math.floor)
            .toHuman({unitDisplay: style});
        return isNegative ? `-${str}` : str;
    }

    const duration = localValue.shiftTo(...UNITS).normalize();
    const formatUnits = truncate === 'truncate' ? [UNITS.find((unit) => duration.get(unit) > 0)!] : UNITS.filter((unit) => duration.get(unit) > 0);

    const str = duration
        .shiftTo(...formatUnits)
        .mapUnits(Math.floor)
        .toHuman({unitDisplay: style});
    return isNegative ? `-${str}` : str;
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
