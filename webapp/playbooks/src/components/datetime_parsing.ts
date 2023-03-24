// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Chrono,
    ParsingOption,
    de,
    en,
    fr,
    ja,
    nl,
    pt,
} from 'chrono-node';
import parseDuration from 'parse-duration';

import {
    DateObjectUnits,
    DateTime,
    Duration,
    DurationLikeObject,
} from 'luxon';

/**
 * Get language from locale
 * @example lang('en-GB') // -> 'en'
 */
const lang = (locale: string) => locale.split('-')[0];

const ChronoParsers: {[lang: string]: Pick<Chrono, 'parse' | 'parseDate'>} = {nl, de, fr, ja, pt};

export enum Mode {
    DateTimeValue = 'DateTimeValue',

    DurationValue = 'DurationValue',

    /** Priority goes to DateTimeValue, else DurationValue */
    AutoValue = 'AutoValue'
}

const chronoParsingOptions: ParsingOption = {forwardDate: true};

export const durationFromQuery = (locale: string, query: string | DurationLikeObject): Duration | null => {
    if (typeof query !== 'string') {
        return Duration.fromObject(query);
    }

    const ms = parseDurationLocalized(locale, query) ?? parseDurationLocalized('en', query);

    return (ms && Duration.fromMillis(ms)) || null;
};

export const parseDateTime = (locale: string, query: string) => {
    return ChronoParsers[lang(locale)]?.parseDate(query, undefined, chronoParsingOptions) ?? en.parseDate(query, undefined, chronoParsingOptions);
};

export const parseDateTimes = (locale: string, query: string) => {
    let datetimes = ChronoParsers[lang(locale)]?.parse(query, undefined, chronoParsingOptions);
    if (!datetimes?.length) {
        datetimes = en.parse(query, undefined, chronoParsingOptions);
    }
    return datetimes;
};

const dateTimeFromQuery = (locale: string, query: string | DateObjectUnits, acceptDurationInput = false): DateTime | null => {
    if (typeof query !== 'string') {
        return DateTime.fromObject(query);
    }

    const date = parseDateTime(locale, query);

    if (date == null && acceptDurationInput) {
        const duration = durationFromQuery(locale, query);

        if (duration?.isValid) {
            return DateTime.now().plus(duration);
        }
    }
    return (date && DateTime.fromJSDate(date)) || null;
};

export function parse(locale: string, query: string, mode?: Mode.DateTimeValue): DateTime | null;
export function parse(locale: string, query: DateObjectUnits, mode?: Mode.DateTimeValue): DateTime;

export function parse(locale: string, query: string, mode?: Mode.DurationValue): Duration | null;
export function parse(locale: string, query: DurationLikeObject, mode?: Mode.DurationValue): Duration;

export function parse(locale: string, query: string | DateObjectUnits | DurationLikeObject, mode?: Mode): DateTime | Duration | null;
export function parse(locale: string, query: string | DateObjectUnits | DurationLikeObject, mode = Mode.AutoValue): DateTime | Duration | null {
    switch (mode) {
    case Mode.DateTimeValue:
        return dateTimeFromQuery(locale, query, true);
    case Mode.DurationValue:
        return durationFromQuery(locale, query);
    case Mode.AutoValue:
    default:
        return dateTimeFromQuery(locale, query) ?? durationFromQuery(locale, query);
    }
}

const localizeDurationRatios = (locale: string): void => {
    DurationRatios[locale] ??= Object.entries(baseUnits).reduce<Ratios>((ratios, [unit, ratio]) => {
        [0, 1, 2, 3, 20, 100] // magic numbers, replace with CLDR plural category minimal pair lookup
            .forEach((value) => getUnits(unit, value, locale).forEach((unitLabel) => {
                if (unitLabel) {
                    ratios[unitLabel.toLowerCase()] = ratio;
                }
            }));
        return ratios;
    }, {});
};

const baseUnits = (() => {
    const {millisecond, second, minute, hour, day, week, month, year} = parseDuration;
    return {millisecond, second, minute, hour, day, week, month, year};
})();

const getUnits = (unit: string, value: number, locale: string) => {
    return [
        new Intl.NumberFormat(locale, {style: 'unit', unit, unitDisplay: 'narrow'})
            .formatToParts(value).find(({type}) => type === 'unit')?.value,
        new Intl.NumberFormat(locale, {style: 'unit', unit, unitDisplay: 'short'})
            .formatToParts(value).find(({type}) => type === 'unit')?.value,
        new Intl.NumberFormat(locale, {style: 'unit', unit, unitDisplay: 'long'})
            .formatToParts(value).find(({type}) => type === 'unit')?.value,
    ];
};

type Ratios = {[unit: string]: number};
export const DurationRatios: {[locale: string]: Ratios} = {en: parseDuration}; // pre-init en and any other locales that need manual i18n tuning

const durationRE = /(-?(?:\d+\.?\d*|\d*\.?\d+)(?:e[-+]?\d+)?)\s*([\p{L}]*)/uig;
const unitRatio = (locale: string, unit: string) => DurationRatios[locale][unit.toLowerCase()] ?? DurationRatios[locale][unit.toLowerCase().replace(/s$/, '')];

/**
 * Internalized to support i18n-isolated ratio contexts to avoid cross-lang unit conflicts. This ensures the query is parsed as-a-whole.
 * @source original https://www.npmjs.com/package/parse-duration
 */
const parseDurationLocalized = (locale: string, query = '', format = 'ms'): number | null => {
    let result: number | null = null;
    localizeDurationRatios(locale);

    String(query)
        .replace(/(\d)[,_](\d)/g, '$1$2') // ignore commas/placeholders
        .replace(durationRE, (_match: string, n: string, unit: string) => {
            const ratio = (unit && unitRatio(locale, unit));
            if (ratio) {
                result = (result || 0) + (parseFloat(n) * ratio);
            }
            return '';
        });

    return result && (result / (unitRatio(locale, format) || 1));
};
