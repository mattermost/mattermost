// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserMentionKey} from 'mattermost-redux/selectors/entities/users';

import {getCurrentMomentForTimezone} from 'utils/timezone';

import type {MentionFilters, MentionType} from 'types/store/rhs';

export const defaultMentionFilters: MentionFilters = {
    channelIds: [],
    mentionTypes: [],
    date: 'any',
};

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
    const parts = [...mentionKeys];

    parts.push(...filters.channelIds.map((channelId) => `in:${channelId}`));

    const dateModifier = dateModifierForRange(filters.date, timezone);
    if (dateModifier) {
        parts.push(dateModifier);
    }

    return parts.join(' ');
}
