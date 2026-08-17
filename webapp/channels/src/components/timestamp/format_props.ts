// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimestampFormat} from '@mattermost/types/config';

import {isSameYear, isWithin} from 'utils/datetime';

import * as RelativeRanges from './relative_ranges';
import type {DateTimeOptions, Props as TimestampProps} from './timestamp';

/**
 * Which presentation a timestamp should take once the user's preferred format is applied.
 *
 * - `post` — post headers. Under `STANDARD` this stays a bare clock time, preserving
 *   the classic message-list look; the other formats render in full.
 * - `metadata` — thread lists, thread footers, previews, file results. Always renders
 *   the selected format in full.
 * - `compact` — forced to the shortest form regardless of the selected format, for
 *   compact display and consecutive posts.
 */
export type TimestampVariant = 'post' | 'metadata' | 'compact';

export type TimestampFormatPropsOptions = {
    format: TimestampFormat;
    showSeconds: boolean;
    variant: TimestampVariant;
};

export type TimestampFormatProps = Pick<
    TimestampProps,
    'useRelative' | 'useDate' | 'useTime' | 'units' | 'ranges' | 'style' | 'numeric' | 'dateTimeSeparator'
>;

const TIME_WITH_SECONDS: DateTimeOptions = {hour: 'numeric', minute: '2-digit', second: '2-digit'};
const TIME_WITHOUT_SECONDS: DateTimeOptions = {hour: 'numeric', minute: '2-digit'};

const CALENDAR_RANGES: TimestampProps['ranges'] = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.YESTERDAY_TITLE_CASE,
];

const RELATIVE_UNITS: TimestampProps['units'] = [
    RelativeRanges.JUST_NOW,
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'year',
];

// Today and yesterday are already handled by CALENDAR_RANGES, so this only covers
// 2+ days back. The rolling `day, -6` window is deliberate: a calendar-week check
// would need a locale-aware week start, which Intl does not expose here.
const useCalendarDate: TimestampProps['useDate'] = ({value}, {timeZone}) => {
    if (isWithin(value, new Date(), timeZone, 'day', -6)) {
        return {weekday: 'short', month: 'short', day: 'numeric'};
    }

    if (isSameYear(value)) {
        return {month: 'short', day: 'numeric'};
    }

    return {month: 'short', day: 'numeric', year: 'numeric'};
};

function build({format, showSeconds, variant}: TimestampFormatPropsOptions): TimestampFormatProps {
    if (format === TimestampFormat.RELATIVE) {
        if (variant === 'compact') {
            return {units: RELATIVE_UNITS, useTime: false, style: 'narrow', numeric: 'always'};
        }

        return {units: RELATIVE_UNITS, useTime: false};
    }

    const useTime = showSeconds && variant !== 'compact' ? TIME_WITH_SECONDS : TIME_WITHOUT_SECONDS;

    if (variant === 'compact' || (variant === 'post' && format === TimestampFormat.STANDARD)) {
        return {useRelative: false, useDate: false, useTime};
    }

    // "Jun 1, 4:32 PM" for a bare date, but "Today at 4:32 PM" when the date half
    // resolved to a relative label instead.
    return {ranges: CALENDAR_RANGES, useDate: useCalendarDate, useTime, dateTimeSeparator: 'comma'};
}

const cache = new Map<string, TimestampFormatProps>();

/**
 * Maps a user's timestamp preference onto {@link Timestamp} props.
 *
 * Results are memoized per (format, showSeconds, variant) — 18 possible keys — because
 * `useDate` is a function and `ranges`/`units` are arrays. Timestamp is a PureComponent,
 * so returning fresh identities on every `mapStateToProps` call would re-render every
 * timestamp on every store change.
 */
export function getTimestampFormatProps(options: TimestampFormatPropsOptions): TimestampFormatProps {
    const key = `${options.format}|${options.showSeconds}|${options.variant}`;

    let props = cache.get(key);
    if (!props) {
        props = Object.freeze(build(options));
        cache.set(key, props);
    }

    return props;
}
