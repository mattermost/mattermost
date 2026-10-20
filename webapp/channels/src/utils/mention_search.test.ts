// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    buildMentionSearchQuery,
    countMentionFilters,
    dateModifierForRange,
    defaultMentionFilters,
    hasMentionFilters,
    mentionFiltersFromSearchParams,
    mentionFiltersToSearchParams,
    mentionKeysForTypes,
} from 'utils/mention_search';

import type {MentionFilters} from 'types/store/rhs';

describe('mentionKeysForTypes', () => {
    const userKeys = [{key: '@jack'}, {key: 'deploys'}, {key: 'Jack', caseSensitive: true}, {key: '@channel'}, {key: '@all'}, {key: '@here'}];
    const groupKeys = [{key: '@developers'}, {key: '@design-team'}];

    test('returns every kind of key when no type is selected', () => {
        expect(mentionKeysForTypes([], 'jack', userKeys, groupKeys)).toEqual([
            '@jack',
            '@developers',
            '@design-team',
            'deploys',
            'Jack',
        ]);
    });

    test('leaves out the channel wide keys', () => {
        const keys = mentionKeysForTypes([], 'jack', userKeys, groupKeys);

        expect(keys).not.toContain('@channel');
        expect(keys).not.toContain('@all');
        expect(keys).not.toContain('@here');
    });

    test('returns only the username for direct mentions', () => {
        expect(mentionKeysForTypes(['direct'], 'jack', userKeys, groupKeys)).toEqual(['@jack']);
    });

    test('returns only the groups for group mentions', () => {
        expect(mentionKeysForTypes(['group'], 'jack', userKeys, groupKeys)).toEqual(['@developers', '@design-team']);
    });

    test('returns only the notification keywords for keyword mentions', () => {
        expect(mentionKeysForTypes(['keyword'], 'jack', userKeys, groupKeys)).toEqual(['deploys', 'Jack']);
    });

    test('combines the selected types', () => {
        expect(mentionKeysForTypes(['direct', 'group'], 'jack', userKeys, groupKeys)).toEqual(['@jack', '@developers', '@design-team']);
    });

    test('does not invent a username key that is not already a mention key', () => {
        expect(mentionKeysForTypes(['direct'], 'jack', [{key: 'deploys'}], [])).toEqual([]);
    });

    test('returns a key reachable two ways only once', () => {
        const keys = mentionKeysForTypes([], 'jack', [{key: '@jack'}], [{key: '@jack'}]);

        expect(keys).toEqual(['@jack']);
    });
});

describe('dateModifierForRange', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date('2026-03-12T09:00:00Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('any time adds no modifier', () => {
        expect(dateModifierForRange('any', 'UTC')).toEqual('');
    });

    test('today searches on that day', () => {
        expect(dateModifierForRange('today', 'UTC')).toEqual('on:2026-03-12');
    });

    test('last 7 days reaches back 7 days, since after: is exclusive of the day it names', () => {
        expect(dateModifierForRange('last_7_days', 'UTC')).toEqual('after:2026-03-05');
    });

    test('uses the given timezone, so that "today" means the user\'s today', () => {
        jest.setSystemTime(new Date('2026-03-12T23:00:00Z'));

        expect(dateModifierForRange('today', 'UTC')).toEqual('on:2026-03-12');
        expect(dateModifierForRange('today', 'America/Los_Angeles')).toEqual('on:2026-03-12');

        // Already the next day in Auckland.
        expect(dateModifierForRange('today', 'Pacific/Auckland')).toEqual('on:2026-03-13');
    });
});

describe('buildMentionSearchQuery', () => {
    test('is just the keys when nothing is filtered', () => {
        expect(buildMentionSearchQuery(['@jack', 'deploys'], defaultMentionFilters)).toEqual('"@jack" "deploys"');
    });

    test('filters by channel id rather than by name, so that the filter works across teams', () => {
        const query = buildMentionSearchQuery(['@jack'], {...defaultMentionFilters, channelIds: ['abc', 'def']});

        expect(query).toEqual('"@jack" in:abc in:def');
    });

    test('adds the date modifier', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-03-12T09:00:00Z'));

        expect(buildMentionSearchQuery(['@jack'], {...defaultMentionFilters, date: 'today'}, 'UTC')).toEqual('"@jack" on:2026-03-12');

        jest.useRealTimers();
    });

    test('quotes the keys so that a keyword that looks like a modifier is still matched as a word', () => {
        const filters: MentionFilters = {...defaultMentionFilters, channelIds: ['abc'], date: 'today'};

        jest.useFakeTimers().setSystemTime(new Date('2026-03-12T09:00:00Z'));

        // `on:call` is one of the user's notification keywords. Left unquoted the server would read
        // it as a date filter, and the generated modifiers beside it have to stay unquoted to keep
        // filtering, so the two can only be told apart here.
        expect(buildMentionSearchQuery(['@jack', 'on:call', 'in:'], filters, 'UTC')).
            toEqual('"@jack" "on:call" "in:" in:abc on:2026-03-12');

        jest.useRealTimers();
    });
});

describe('mention filters in the popout URL', () => {
    const channelA = 'a'.repeat(26);
    const channelB = 'b1'.repeat(13);

    test('round trips the filters', () => {
        const filters: MentionFilters = {channelIds: [channelA, channelB], mentionTypes: ['direct', 'keyword'], date: 'last_7_days'};

        const params = new URLSearchParams(mentionFiltersToSearchParams(filters));

        expect(params.toString()).toEqual(`mentionChannels=${channelA}%2C${channelB}&mentionTypes=direct%2Ckeyword&mentionDate=last_7_days`);
        expect(mentionFiltersFromSearchParams(params)).toEqual(filters);
    });

    test('writes nothing for filters that are not applied', () => {
        expect(mentionFiltersToSearchParams(defaultMentionFilters)).toEqual({});
    });

    test('reads an URL with no filters on it as no filters', () => {
        expect(mentionFiltersFromSearchParams(new URLSearchParams('q=%40jack&mode=mention'))).toEqual(defaultMentionFilters);
    });

    test('drops values it does not recognise rather than searching on them', () => {
        const params = new URLSearchParams(`mentionChannels=${channelA},,&mentionTypes=direct,nonsense&mentionDate=yesterday`);

        expect(mentionFiltersFromSearchParams(params)).toEqual({
            channelIds: [channelA],
            mentionTypes: ['direct'],
            date: 'any',
        });
    });

    test('drops channel values that are not ids, so they cannot add terms or modifiers to the query', () => {
        const params = new URLSearchParams();
        params.set('mentionChannels', `${channelA},abc on:2020-01-01,${channelB.toUpperCase()},${channelB}x`);

        expect(mentionFiltersFromSearchParams(params).channelIds).toEqual([channelA]);
    });
});

describe('hasMentionFilters and countMentionFilters', () => {
    test('nothing applied', () => {
        expect(hasMentionFilters(defaultMentionFilters, null)).toBe(false);
        expect(countMentionFilters(defaultMentionFilters, null)).toEqual(0);
    });

    test('a team on its own counts as a filter', () => {
        expect(hasMentionFilters(defaultMentionFilters, 'team1')).toBe(true);
        expect(countMentionFilters(defaultMentionFilters, 'team1')).toEqual(1);
    });

    test('counts each channel and mention type separately', () => {
        const filters = {channelIds: ['a', 'b'], mentionTypes: ['direct' as const], date: 'today' as const};

        expect(hasMentionFilters(filters, 'team1')).toBe(true);
        expect(countMentionFilters(filters, 'team1')).toEqual(5);
    });
});
