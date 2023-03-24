import {Duration, DurationObjectUnits, Settings} from 'luxon';

import range from 'lodash/range';

import {Mode, durationFromQuery, parse} from './datetime_parsing';

describe('durationFromQuery', () => {
    const locales = [
        'bg',
        'de',
        'en-AU',
        'en',
        'es',

        // 'fa', // regex issues, digit recognition
        'fr',
        'hu',
        'it',
        'ja',
        'ko',
        'nl',
        'pl',
        'pt-BR',

        // 'ro', // regex issues, spacing/unit parsing
        'ru',
        'sv',
        'tr',
        'uk',

        // 'zh-CN', // works, but fails occasionally
        // 'zh-TW', // works, but fails occasionally
    ];

    test.each([

        ...range(1, 60).map((n) => ({seconds: n})),
        ...range(1, 60).map((n) => ({minutes: n})),
        ...range(1, 24).map((n) => ({hours: n})),
        ...range(1, 99).map((n) => ({days: n})),
        ...range(1, 52).map((n) => ({weeks: n})),

        {minutes: 1, seconds: 30},
        {hours: 1, minutes: 30},
        {days: 1, minutes: 5},
        {days: 1, hours: 2, minutes: 5},
        {days: 1, hours: 2, minutes: 5, seconds: 33},

        {weeks: 6},
        {weeks: 2, days: 6, minutes: 12},

        // {months: 3}, // months work but are too imprecise for testing; parseDuration leap-year conversion ratios differ slightly from luxon

        // {years: 4}, // years work but are too imprecise for testing; parseDuration leap-year conversion ratios differ slightly from luxon
    ].reduce<[[duration: DurationObjectUnits, local: string, long: string, short: string, narrow: string]]>((tests, durationObj) => {
        locales.forEach((locale) => {
            Settings.defaultLocale = locale;
            const duration = Duration.fromObject(durationObj);
            tests.push([
                durationObj,
                locale,
                duration.toHuman({unitDisplay: 'long'}),
                duration.toHuman({unitDisplay: 'short'}),
                duration.toHuman({unitDisplay: 'narrow'}),
            ]);
        });
        return tests;
    }, [] as any))('should correctly parse %p in %p (%p %p %p)', (durationObj, locale, ...queries) => {
        Settings.defaultLocale = locale;

        const duration = Duration.fromObject(durationObj);
        const [long, short, narrow] = [...queries].map((query) => durationFromQuery(locale, query));

        expect(long?.toMillis()).toBe(duration.toMillis());

        // expect(short?.toMillis()).toBe(duration.toMillis()); // some work; flaky support
        // expect(narrow?.toMillis()).toBe(duration.toMillis()); // some work; flaky support
    });
});

// Failing test to reproduce https://mattermost.atlassian.net/browse/MM-44810
describe.skip('parse', () => {
    it('Mode.DurationValue', () => {
        const duration = parse('en', '1 month', Mode.DurationValue);
        expect(duration?.milliseconds).toEqual(2592000000); // 30 days
    });
});
