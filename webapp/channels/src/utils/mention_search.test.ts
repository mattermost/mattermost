// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    buildMentionSearchQuery,
    countMentionFilters,
    dateModifierForRange,
    defaultMentionFilters,
    hasMentionFilters,
    mentionKeysForTypes,
} from 'utils/mention_search';

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
        expect(buildMentionSearchQuery(['@jack', 'deploys'], defaultMentionFilters)).toEqual('@jack deploys');
    });

    test('filters by channel id rather than by name, so that the filter works across teams', () => {
        const query = buildMentionSearchQuery(['@jack'], {...defaultMentionFilters, channelIds: ['abc', 'def']});

        expect(query).toEqual('@jack in:abc in:def');
    });

    test('adds the date modifier', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-03-12T09:00:00Z'));

        expect(buildMentionSearchQuery(['@jack'], {...defaultMentionFilters, date: 'today'}, 'UTC')).toEqual('@jack on:2026-03-12');

        jest.useRealTimers();
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
