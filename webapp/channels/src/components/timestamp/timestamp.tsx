// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import caps from 'lodash/capitalize';
import isArray from 'lodash/isArray';
import React, {PureComponent} from 'react';
import type {ReactNode} from 'react';
import {
    injectIntl,
    FormattedMessage,
} from 'react-intl';
import type {
    IntlShape,
    FormatDateOptions,
    FormatRelativeTimeOptions} from 'react-intl';
import {isValidElementType} from 'react-is';

import type {Either, RequireOnlyOne} from '@mattermost/types/utilities';

import {isSameYear, isWithin, isEqual, getDiff} from 'utils/datetime';
import {resolve} from 'utils/resolvable';
import type {Resolvable} from 'utils/resolvable';

import {STANDARD_UNITS} from './relative_ranges';
import SemanticTime from './semantic_time';

export type DateTimeOptions = FormatDateOptions & {
    hourCycle?: string;
};

export type RelativeOptions = FormatRelativeTimeOptions & {
    unit: Intl.RelativeTimeFormatUnit;
    relNearest?: number;
    truncateEndpoints?: boolean;
    updateIntervalInSeconds?: number;
    capitalize?: boolean;
};

function isRelative(format: ResolvedFormats['relative']): format is RelativeOptions {
    return Boolean((format as RelativeOptions)?.unit);
}

export type SimpleRelativeOptions = {
    message: ReactNode;
    updateIntervalInSeconds?: number;
};

function isSimpleRelative(format: unknown): format is SimpleRelativeOptions {
    return (format as SimpleRelativeOptions)?.message != null;
}

const defaultRefreshIntervals = new Map<Intl.RelativeTimeFormatUnit, number /* seconds */>([
    ['hour', 60 * 5],
    ['minute', 15],
    ['second', 1],
]);

type UnitDescriptor = [Intl.RelativeTimeFormatUnit, number?, boolean?];

function isUnitDescriptor(unit: unknown): unit is UnitDescriptor {
    return isArray(unit) && typeof unit[0] === 'string';
}

type Breakpoint = RequireOnlyOne<{
    within: UnitDescriptor;
    equals: UnitDescriptor;
}>;

type DisplayAs = {
    display: UnitDescriptor | ReactNode;
    updateIntervalInSeconds?: number;
    capitalize?: boolean;
};

export type RangeDescriptor = Breakpoint & DisplayAs;

function normalizeRangeDescriptor(unit: NonNullable<Props['units']>[number]): RangeDescriptor {
    if (typeof unit === 'string' || typeof unit === 'number') {
        return STANDARD_UNITS[unit];
    }
    if (isUnitDescriptor(unit)) {
        const [u, n] = unit;
        return {within: [u, n], display: [u]};
    }
    return unit;
}

export type ResolvedFormats = {
    relative: RelativeOptions | SimpleRelativeOptions | false;
    date: DateTimeOptions | false;
    time: DateTimeOptions | false;
};

/** Parts left to join, or the single string Intl already combined -- never both. */
type FormattedParts = Either<
    {relative?: ReactNode; date?: ReactNode; time?: ReactNode},
    {datetime: ReactNode}
>;

type FormatOptions = DateTimeOptions & Partial<RelativeOptions>;

export type Props = FormatOptions & {
    value?: ConstructorParameters<typeof Date>[0];

    useRelative?: Resolvable<ResolvedFormats['relative'], {value: Date}, FormatOptions>;
    units?: Array<RangeDescriptor | UnitDescriptor | Intl.RelativeTimeFormatUnit | keyof typeof STANDARD_UNITS>;
    ranges?: Props['units'];
    useDate?: Resolvable<Exclude<ResolvedFormats['date'], 'timeZone'> | false, {value: Date}, FormatOptions>;
    useTime?: Resolvable<Exclude<ResolvedFormats['time'], 'timeZone' | 'hourCycle' | 'hour12'> | false, {value: Date}, FormatOptions>;

    children?: Resolvable<ReactNode, {value: Date; timeZone: DateTimeOptions['timeZone']; formatted: ReactNode} & FormattedParts, ResolvedFormats>;
    className?: string;
    label?: string;
    useSemanticOutput?: boolean;

    /**
     * How to join the date and time halves.
     *
     * `at` (the default) joins them with the `timestamp.datetime` message.
     *
     * `locale` hands both halves to Intl in a single pass so the locale decides the
     * separator -- en-US yields "Jun 1, 4:32 PM", ja-JP a space -- which reads better
     * after a bare date than any separator we could pick and translate.
     * A date half that resolved to a relative label is still joined with `at`, since
     * "Today at 4:32 PM" is right where "Today, 4:32 PM" is not.
     */
    dateTimeSeparator?: 'at' | 'locale';

    intl: IntlShape;
};

type State = {
    now: Date;
    prevValue: Props['value'];
};

/**
 * A feature-rich, react-intl oriented wrapper around Intl.DateTimeFormat and Intl.RelativeTimeFormat.
 *
 * `DateTimeOptions.hourCycle` is preferred over `DateTimeOptions.hour12`.
 *
 * `hour12` will override the specified `hourCycle` and will defer to the default locale `hourCycle`.
 * This might result in `H24` behavior. (See https://github.com/formatjs/formatjs/issues/1577)
 */
class Timestamp extends PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            now: new Date(),
            prevValue: props.value,
        };
    }

    static defaultProps: Partial<Props> = {

        // relative
        numeric: 'auto',
        style: 'long',
        relNearest: 1,

        // fixed
        year: 'numeric',
        month: 'long',
        day: '2-digit',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h12',
        timeZoneName: 'short',
    };
    nextUpdate: ReturnType<typeof setTimeout> | null = null;
    mounted = false;

    componentDidMount() {
        this.mounted = true;
    }

    formatParts(value: Date, {relative: relFormat, date: dateFormat, time: timeFormat}: ResolvedFormats): FormattedParts {
        let relative: FormattedParts['relative'];
        let date: FormattedParts['date'];
        let time: FormattedParts['time'];

        if (isSimpleRelative(relFormat)) {
            relative = relFormat.message;
        } else if (isRelative(relFormat)) {
            relative = this.formatRelative(value, relFormat);

            if (relFormat.unit !== 'day' || !timeFormat) {
                return {relative};
            }
        }

        const {hourCycle, hour12} = this.props;

        if (relative == null && dateFormat) {
            // Formatting both halves in one pass lets Intl apply the locale's own
            // date/time separator -- CLDR picks ", " or " at " from the width of the
            // date fields -- instead of one we choose and have to translate.
            if (timeFormat && this.props.dateTimeSeparator === 'locale') {
                return {datetime: this.formatDateTime(value, {hourCycle, hour12, ...dateFormat, ...timeFormat})};
            }

            date = this.formatDateTime(value, dateFormat);
        }

        if (timeFormat) {
            time = this.formatDateTime(value, {hourCycle, hour12, ...timeFormat});
        }

        return {relative, date, time};
    }

    formatRelative(value: Date, {unit, relNearest, truncateEndpoints, ...format}: RelativeOptions): string {
        let diff: number;

        if (relNearest === 0) {
            diff = 0;
        } else {
            diff = getDiff(value, this.state.now, this.props.timeZone, unit, truncateEndpoints);
            if (relNearest != null) {
                diff = Math.round(diff / relNearest) * relNearest;
            }
        }

        if (diff === 0) {
            diff = value <= this.state.now ? -0 : +0;
        }

        const rel = this.props.intl.formatRelativeTime(diff, unit, format);
        return format.capitalize ? caps(rel) : rel;
    }

    formatDateTime(value: Date, format: DateTimeOptions): string {
        const {timeZone, intl} = this.props;

        return intl.formatDate(value, {timeZone, ...format});
    }

    autoRange(value: Date, units: Props['units'] = (this.props.units || this.props.ranges)): DisplayAs {
        return units?.map(normalizeRangeDescriptor).find(({equals, within}) => {
            if (equals != null) {
                return isEqual(value, this.state.now, this.props.timeZone, ...equals);
            }
            if (within != null) {
                return isWithin(value, this.state.now, this.props.timeZone, ...within);
            }
            return false;
        }) ?? {
            display: [this.props.unit],
            updateIntervalInSeconds: this.props.updateIntervalInSeconds,
        };
    }

    private getFormats(value: Date): ResolvedFormats {
        const {
            numeric,
            style,
            useRelative = (): ResolvedFormats['relative'] => {
                const {
                    display,
                    updateIntervalInSeconds = this.props.updateIntervalInSeconds,
                    capitalize = this.props.capitalize,
                } = this.autoRange(value);

                if (display) {
                    if (isValidElementType(display) || !Array.isArray(display)) {
                        return {
                            message: display,
                            updateIntervalInSeconds,
                        };
                    }

                    const [
                        unit,
                        relNearest = this.props.relNearest,
                        truncateEndpoints = this.props.truncateEndpoints,
                    ] = display as UnitDescriptor;

                    if (unit) {
                        return {
                            unit,
                            relNearest,
                            truncateEndpoints,
                            numeric,
                            style,
                            updateIntervalInSeconds: updateIntervalInSeconds ?? defaultRefreshIntervals.get(unit),
                            capitalize,
                        };
                    }
                }

                return false;
            },
            year,
            month,
            day,
            weekday,
            hour,
            minute,
            timeZone,
            useDate = (): ResolvedFormats['date'] => {
                if (isWithin(value, this.state.now, timeZone, 'day', -6)) {
                    return {weekday};
                }
                if (isSameYear(value)) {
                    return {day, month};
                }

                return {year, month, day};
            },
            useTime = {hour, minute},
        } = this.props;

        const relative = resolve(useRelative, {value}, this.props);
        const date = !relative && resolve(useDate, {value}, this.props);
        const time = resolve(useTime, {value}, this.props);

        return {relative, date, time};
    }

    componentWillUnmount() {
        this.mounted = false;
        if (this.nextUpdate) {
            clearTimeout(this.nextUpdate);
            this.nextUpdate = null;
        }
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (props.value !== state.prevValue) {
            return ({now: new Date(), prevValue: props.value});
        }

        return null;
    }

    private maybeUpdate(relative: ResolvedFormats['relative']): ReturnType<typeof setTimeout> | null {
        if (!relative ||
            !relative.updateIntervalInSeconds) {
            return null;
        }
        return setTimeout(() => {
            if (this.mounted) {
                this.setState({now: new Date()});
            }
        }, relative.updateIntervalInSeconds * 1000);
    }

    static format({relative, date, time, datetime}: FormattedParts): ReactNode {
        if (datetime) {
            return datetime;
        }

        return (relative || date) && time ? (
            <FormattedMessage
                id='timestamp.datetime'
                defaultMessage='{relativeOrDate} at {time}'
                values={{
                    relativeOrDate: relative || date,
                    time,
                }}
            />
        ) : relative || date || time;
    }

    render() {
        const {
            value: unparsed = this.state.now,
            children,
            useSemanticOutput = true,
            timeZone,
            label,
            className,
        } = this.props;

        const value = unparsed instanceof Date ? unparsed : new Date(unparsed);
        const formats = this.getFormats(value);
        const parts = this.formatParts(value, formats);
        let formatted = Timestamp.format(parts);

        if (useSemanticOutput) {
            formatted = (
                <SemanticTime
                    value={value}
                    timeZone={timeZone}
                    aria-label={label}
                    className={className}
                >
                    {formatted}
                </SemanticTime>
            );
        }

        this.nextUpdate = this.maybeUpdate(formats.relative);

        if (children) {
            return resolve(children, {value, timeZone, formatted, ...parts}, formats);
        }

        return formatted;
    }
}

export default injectIntl(Timestamp);
