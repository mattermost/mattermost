// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserMentionKey} from 'mattermost-redux/selectors/entities/users';

import {ID_PATH_PATTERN} from 'utils/path';
import {getCurrentMomentForTimezone} from 'utils/timezone';

import type {MentionDateRange, MentionFilters, MentionType} from 'types/store/rhs';

export const defaultMentionFilters: MentionFilters = {
    channelIds: [],
    mentionTypes: [],
    date: 'any',
};

// The orders the filters are offered in, and the only values a filter can hold. They live here
// rather than beside the labels so that rendering and parsing can't drift apart.
export const mentionTypeOrder: MentionType[] = ['direct', 'group', 'keyword'];

export const dateRangeOrder: MentionDateRange[] = ['any', 'today', 'last_7_days'];

export function hasMentionFilters(filters: MentionFilters, teamId: string | null): boolean {
    return Boolean(teamId) || filters.channelIds.length > 0 || filters.mentionTypes.length > 0 || filters.date !== 'any';
}

export function countMentionFilters(filters: MentionFilters, teamId: string | null): number {
    let count = filters.channelIds.length + filters.mentionTypes.length;
    if (teamId) {
        count += 1;
    }
    if (filters.date !== 'any') {
        count += 1;
    }
    return count;
}

// mentionKeysForTypes splits the keys that a mention search matches on by the kind of mention they
// stand for, so that the mention type filter can leave some of them out. Selecting no type is the
// same as selecting every type.
export function mentionKeysForTypes(
    types: MentionType[],
    username: string,
    userMentionKeys: UserMentionKey[],
    groupMentionKeys: UserMentionKey[],
): string[] {
    const usernameKey = `@${username}`;

    // @channel, @all and @here are left out of recent mentions entirely: they match far more posts
    // than the user thinks of as a mention of them.
    const channelWideKeys = ['@channel', '@all', '@here'];

    const ownKeys = userMentionKeys.
        map(({key}) => key).
        filter((key) => !channelWideKeys.includes(key));

    const directKeys = ownKeys.filter((key) => key === usernameKey);
    const keywordKeys = ownKeys.filter((key) => key !== usernameKey);

    const keys: string[] = [];
    const wantsAll = types.length === 0;

    if (wantsAll || types.includes('direct')) {
        keys.push(...directKeys);
    }
    if (wantsAll || types.includes('group')) {
        keys.push(...groupMentionKeys.map(({key}) => key));
    }
    if (wantsAll || types.includes('keyword')) {
        keys.push(...keywordKeys);
    }

    // A key can be reached more than one way, e.g. a user whose username is also one of their
    // notification keywords.
    return [...new Set(keys)].filter((key) => Boolean(key.trim()));
}

// dateModifierForRange turns a date range into the search modifier that expresses it, or an empty
// string for 'any'. `after:` is exclusive of the day it names, so the last 7 days reaches back 7
// days to include the 6 days before today.
export function dateModifierForRange(range: MentionFilters['date'], timezone?: string): string {
    const now = getCurrentMomentForTimezone(timezone);

    switch (range) {
    case 'today':
        return `on:${now.format('YYYY-MM-DD')}`;
    case 'last_7_days':
        return `after:${now.subtract(7, 'days').format('YYYY-MM-DD')}`;
    default:
        return '';
    }
}

// buildMentionSearchQuery assembles the query actually sent to the server. Channels are filtered by
// id rather than by name: a name only identifies a channel within one team, so names can't express a
// filter that spans teams (see the TODO in App.SearchPostsForUser). The server resolves an in: value
// it can't find by name as an id, which is what makes this work.
export function buildMentionSearchQuery(mentionKeys: string[], filters: MentionFilters, timezone?: string): string {
    // The keys are quoted here rather than on the way out of performSearch. Quoting keeps a key that
    // is split by dashes or other symbols together as one unit, and doing it before the modifiers
    // are added is the only point at which the two can still be told apart: a user whose
    // notification keywords include `on:call` would otherwise have it read as a date filter.
    const parts = mentionKeys.map((key) => `"${key}"`);

    parts.push(...filters.channelIds.map((channelId) => `in:${channelId}`));

    const dateModifier = dateModifierForRange(filters.date, timezone);
    if (dateModifier) {
        parts.push(dateModifier);
    }

    return parts.join(' ');
}

// The query string parameters the filters travel in when a filtered mentions panel is popped out
// into its own window. The popout starts from an empty store, so the URL is all it has to go on.
const CHANNELS_PARAM = 'mentionChannels';
const TYPES_PARAM = 'mentionTypes';
const DATE_PARAM = 'mentionDate';

export function mentionFiltersToSearchParams(filters: MentionFilters): Record<string, string> {
    const params: Record<string, string> = {};

    if (filters.channelIds.length > 0) {
        params[CHANNELS_PARAM] = filters.channelIds.join(',');
    }
    if (filters.mentionTypes.length > 0) {
        params[TYPES_PARAM] = filters.mentionTypes.join(',');
    }
    if (filters.date !== 'any') {
        params[DATE_PARAM] = filters.date;
    }

    return params;
}

function splitParam(value: string | null): string[] {
    return (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
}

const CHANNEL_ID_REGEX = new RegExp(`^${ID_PATH_PATTERN}$`);

// mentionFiltersFromSearchParams reads back what mentionFiltersToSearchParams wrote. Anything it
// doesn't recognise is dropped rather than carried into a search: a popout URL can be edited by
// hand, an unknown mention type or date range has no meaning to the query builder, and a channel
// value that isn't an id would go into the query as is, adding terms or modifiers of its own.
export function mentionFiltersFromSearchParams(params: URLSearchParams): MentionFilters {
    const date = params.get(DATE_PARAM) as MentionDateRange;

    return {
        channelIds: splitParam(params.get(CHANNELS_PARAM)).filter((id) => CHANNEL_ID_REGEX.test(id)),
        mentionTypes: splitParam(params.get(TYPES_PARAM)).filter((type): type is MentionType => (mentionTypeOrder as string[]).includes(type)),
        date: dateRangeOrder.includes(date) ? date : 'any',
    };
}
