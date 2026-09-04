// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post, PostList} from '@mattermost/types/posts';
import type {UserThreadWithPost} from '@mattermost/types/threads';

import {receivedPosts} from 'mattermost-redux/actions/posts';
import {getMissingChannelsFromPosts} from 'mattermost-redux/actions/search';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getChannel, getUnsortedAllTeamsUnreadChannels} from 'mattermost-redux/selectors/entities/channels';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId, getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';
import type {DispatchFunc} from 'mattermost-redux/types/actions';
import {isDirectChannel, isGroupChannel} from 'mattermost-redux/utils/channel_utils';
import {isUserAddedInChannel} from 'mattermost-redux/utils/post_utils';

import {getPlatformNotifications} from 'selectors/rhs';

import {ActionTypes} from 'utils/constants';
import {
    consolidateThreadReplyNotifications,
    enrichPlatformNotificationRecords,
} from 'utils/platform_notification_activity_merge';
import {buildPlatformNotificationRecordFromPost} from 'utils/platform_notification_activity_record';
import {
    isPlatformNotificationDismissed,
    syncPlatformNotificationActivityToServer,
    syncPlatformNotificationActivityToStorage,
} from 'utils/platform_notification_activity_storage';
import {getBrowserUtcOffset, getUtcOffsetForTimeZone} from 'utils/timezone';

import type {ActionFuncAsync} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

const SEED_MENTION_PAGE_SIZE = 60;
const SEED_THREAD_PAGE_SIZE = 25;
const SEED_DM_CHANNEL_MAX = 20;

function mentionSearchTerms(state: Parameters<typeof getCurrentUserMentionKeys>[0]): string {
    const termKeys = getCurrentUserMentionKeys(state).filter(({key}) => {
        return key !== '@channel' && key !== '@all' && key !== '@here';
    });
    return termKeys.map(({key}) => `"${key}"`).join(' ');
}

function searchTimezoneOffsetSeconds(state: Parameters<typeof getCurrentTimezone>[0]): number {
    const userCurrentTimezone = getCurrentTimezone(state);
    return ((userCurrentTimezone && userCurrentTimezone.length > 0) ? getUtcOffsetForTimeZone(userCurrentTimezone) : getBrowserUtcOffset()) * 60;
}

async function ingestPosts(dispatch: DispatchFunc, posts: Record<string, Post> | undefined) {
    if (!posts || Object.keys(posts).length === 0) {
        return;
    }

    dispatch(receivedPosts({
        order: Object.keys(posts),
        posts,
        next_post_id: '',
        prev_post_id: '',
        first_inaccessible_post_time: 0,
    } as PostList));
    await Promise.all([
        dispatch(getMissingProfilesByIds(Object.values(posts).map((post) => post.user_id))),
        dispatch(getMissingChannelsFromPosts(posts)),
    ]);
}

function recordFromPost(
    state: Parameters<typeof getCurrentUserId>[0],
    post: Post,
    flags: {
        isMention: boolean;
        isThreadReply: boolean;
        isAddedToChannel?: boolean;
        allowOwnPost?: boolean;
        recordedAt?: number;
        replyCount?: number;
        participantUserIds?: string[];
    },
): PlatformNotificationRecord | null {
    const currentUserId = getCurrentUserId(state);
    if (!currentUserId || (post.user_id === currentUserId && !flags.allowOwnPost)) {
        return null;
    }
    if (isPlatformNotificationDismissed(state, post.id, post.create_at, [post.root_id])) {
        return null;
    }

    const channel = getChannel(state, post.channel_id);
    if (!channel) {
        return null;
    }

    return buildPlatformNotificationRecordFromPost(state, post, channel as Channel, channel.team_id || '', flags);
}

function mergeSeededRecords(existing: PlatformNotificationRecord[], incoming: PlatformNotificationRecord[]): PlatformNotificationRecord[] {
    const byPostId = new Map(existing.map((record) => [record.postId, record]));
    for (const record of incoming) {
        if (!byPostId.has(record.postId)) {
            byPostId.set(record.postId, record);
        }
    }
    return Array.from(byPostId.values());
}

export function seedPlatformNotificationRecords(): ActionFuncAsync<PlatformNotificationRecord[]> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        if (!currentUserId) {
            return {data: []};
        }

        const records: PlatformNotificationRecord[] = [];
        const seenPostIds = new Set<string>();
        const addRecord = (record: PlatformNotificationRecord | null) => {
            if (!record || seenPostIds.has(record.postId)) {
                return;
            }
            seenPostIds.add(record.postId);
            records.push(record);
        };

        const terms = mentionSearchTerms(state);
        if (terms) {
            try {
                const mentionResults = await Client4.searchPostsWithParams('', {
                    terms,
                    is_or_search: true,
                    include_deleted_channels: true,
                    time_zone_offset: searchTimezoneOffsetSeconds(state),
                    page: 0,
                    per_page: SEED_MENTION_PAGE_SIZE,
                });
                await ingestPosts(dispatch, mentionResults?.posts);
                const afterMentions = getState();
                const crtEnabled = isCollapsedThreadsEnabled(afterMentions);
                for (const postId of mentionResults?.order || []) {
                    const post = mentionResults.posts?.[postId];
                    if (!post) {
                        continue;
                    }
                    const isAddedToChannel = isUserAddedInChannel(post, currentUserId);
                    addRecord(recordFromPost(afterMentions, post, {
                        isMention: !isAddedToChannel,
                        isThreadReply: crtEnabled && Boolean(post.root_id),
                        isAddedToChannel,
                    }));
                }
            } catch {
                // Mentions tab still works from its own search; Activity seed is best effort.
            }
        }

        try {
            const teams = getMyTeams(getState());
            const threadLists = await Promise.all(teams.map((team) => (
                Client4.getUserThreads(currentUserId, team.id, {
                    unread: true,
                    extended: true,
                    perPage: SEED_THREAD_PAGE_SIZE,
                    threadsOnly: true,
                }).catch(() => null)
            )));

            const threadPosts: Record<string, Post> = {};
            const threads: UserThreadWithPost[] = [];
            for (const list of threadLists) {
                for (const thread of list?.threads || []) {
                    if (thread.post) {
                        threadPosts[thread.post.id] = thread.post;
                        threads.push(thread);
                    }
                }
            }
            await ingestPosts(dispatch, threadPosts);

            const afterThreads = getState();
            for (const thread of threads) {
                const post = thread.post;
                if (isPlatformNotificationDismissed(afterThreads, post.id, thread.last_reply_at || post.create_at, [thread.id])) {
                    continue;
                }
                addRecord(recordFromPost(afterThreads, post, {
                    isMention: thread.unread_mentions > 0,
                    isThreadReply: true,
                    allowOwnPost: true,
                    recordedAt: thread.last_reply_at || post.create_at,
                    replyCount: thread.unread_replies || thread.reply_count,
                    participantUserIds: thread.participants?.map((participant) => participant.id),
                }));
            }
        } catch {
            // Followed-thread seed is best effort.
        }

        const unreadChannels = getUnsortedAllTeamsUnreadChannels(getState()).
            filter((channel) => isDirectChannel(channel) || isGroupChannel(channel)).
            slice(0, SEED_DM_CHANNEL_MAX);

        await Promise.all(unreadChannels.map(async (channel) => {
            try {
                const posts = await Client4.getPosts(channel.id, 0, 1);
                await ingestPosts(dispatch, posts?.posts);
                const latestId = posts?.order?.[0];
                const post = latestId ? posts.posts?.[latestId] : undefined;
                if (!post || post.user_id === currentUserId) {
                    return;
                }
                addRecord(recordFromPost(getState(), post, {
                    isMention: false,
                    isThreadReply: false,
                }));
            } catch {
                // Unread DM/GM seed is best effort.
            }
        }));

        const afterAll = getState();
        for (const post of Object.values(afterAll.entities.posts.posts)) {
            if (!isUserAddedInChannel(post, currentUserId)) {
                continue;
            }
            addRecord(recordFromPost(afterAll, post, {
                isMention: false,
                isThreadReply: false,
                isAddedToChannel: true,
            }));
        }

        return {data: records};
    };
}

export function fillPlatformNotificationActivity(): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const seeded = (await dispatch(seedPlatformNotificationRecords())).data || [];
        if (seeded.length === 0) {
            return {data: false};
        }

        const existing = getPlatformNotifications(getState());
        const merged = mergeSeededRecords(existing, seeded);
        if (merged.length === existing.length) {
            return {data: false};
        }

        const enriched = enrichPlatformNotificationRecords(getState(), merged);
        const consolidated = consolidateThreadReplyNotifications(enriched);
        dispatch({
            type: ActionTypes.HYDRATE_PLATFORM_NOTIFICATIONS,
            data: consolidated,
        });
        syncPlatformNotificationActivityToStorage(getState(), getPlatformNotifications(getState()));

        try {
            await syncPlatformNotificationActivityToServer(getState(), getPlatformNotifications(getState()));
        } catch {
            // Server persist is optional until the running binary has the API.
        }

        return {data: true};
    };
}
