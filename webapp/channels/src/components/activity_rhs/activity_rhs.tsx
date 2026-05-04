// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {FormattedDate, FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getUser, getCurrentUserMentionKeys} from 'mattermost-redux/selectors/entities/users';

import WithTooltip from 'components/with_tooltip';

import {getHistory} from 'utils/browser_history';
import {ActionTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './activity_rhs.scss';

type ReceivedReaction = {
    user_id: string;
    post_id: string;
    emoji_name: string;
    create_at: number;
    channel_id: string;
    post_message: string;
    post_author_id: string;
};

type ReactionGroup = {
    postId: string;
    channelId: string;
    postMessage: string;
    latestCreateAt: number;
    emojis: Array<{name: string; userIds: string[]}>;
    distinctUsers: string[];
};

type ActivityItem =
    | {kind: 'reaction'; key: string; createAt: number; data: ReactionGroup}
    | {kind: 'mention'; key: string; createAt: number; data: Post};

const truncate = (text: string, max = 120) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
};

const UserName = ({userId}: {userId: string}) => {
    const user = useSelector((state: GlobalState) => getUser(state, userId));
    return <strong>{user?.username ? `@${user.username}` : userId}</strong>;
};

const ChannelName = ({channelId}: {channelId: string}) => {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    return <span className='ActivityRhs__channel'>{channel?.display_name || channel?.name || ''}</span>;
};

// Resolves an array of user IDs to a comma-separated list of @usernames
// for use inside a tooltip.
const ReactorListTooltipContent = ({userIds}: {userIds: string[]}) => {
    const names = useSelector((state: GlobalState) => userIds.map((id) => {
        const u = getUser(state, id);
        return u?.username ? `@${u.username}` : id;
    }));
    return <span>{names.join(', ')}</span>;
};

const EmojiCountButton = ({emojiName, userIds}: {emojiName: string; userIds: string[]}) => (
    <WithTooltip title={<ReactorListTooltipContent userIds={userIds}/>}>
        <span className='ActivityRhs__emojiBtn'>
            {`:${emojiName}:`}
            <span className='ActivityRhs__emojiCount'>{userIds.length}</span>
        </span>
    </WithTooltip>
);

// Render a friendly relative time: "vài giây trước", "X phút trước",
// "X giờ trước", "hôm qua", "hôm kia", "X ngày trước", or absolute date.
const RelativeTime = ({createAt}: {createAt: number}) => {
    const now = Date.now();
    const diffMs = Math.max(0, now - createAt);
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);

    const startOfDay = (t: number) => {
        const d = new Date(t);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };
    const diffDays = Math.round((startOfDay(now) - startOfDay(createAt)) / 86400000);

    if (diffMin < 1) {
        return <FormattedMessage id='activity.rhs.timeJustNow' defaultMessage='vài giây trước'/>;
    }
    if (diffMin < 60) {
        return <FormattedMessage id='activity.rhs.timeMinutes' defaultMessage='{n} phút trước' values={{n: diffMin}}/>;
    }
    if (diffDays === 0) {
        return <FormattedMessage id='activity.rhs.timeHours' defaultMessage='{n} giờ trước' values={{n: diffHour}}/>;
    }
    if (diffDays === 1) {
        return <FormattedMessage id='activity.rhs.timeYesterday' defaultMessage='hôm qua'/>;
    }
    if (diffDays === 2) {
        return <FormattedMessage id='activity.rhs.timeBeforeYesterday' defaultMessage='hôm kia'/>;
    }
    if (diffDays < 7) {
        return <FormattedMessage id='activity.rhs.timeDays' defaultMessage='{n} ngày trước' values={{n: diffDays}}/>;
    }
    return <FormattedDate value={createAt} month='short' day='numeric'/>;
};

// Show "@user1" / "@user1 & @user2" / "@user1 & N others"
const ReactorsHeader = ({userIds}: {userIds: string[]}) => {
    const usernames = useSelector((state: GlobalState) => userIds.slice(0, 2).map((id) => {
        const u = getUser(state, id);
        return u?.username ? `@${u.username}` : id;
    }));
    if (userIds.length === 0) {
        return null;
    }
    if (userIds.length === 1) {
        return <strong>{usernames[0]}</strong>;
    }
    if (userIds.length === 2) {
        return <strong>{`${usernames[0]} & ${usernames[1]}`}</strong>;
    }
    return <strong>{`${usernames[0]} & ${userIds.length - 1} others`}</strong>;
};

const ActivityRhs = () => {
    const dispatch = useDispatch();
    const userId = useSelector(getCurrentUserId);
    const teamId = useSelector(getCurrentTeamId);
    const teamName = useSelector((state: GlobalState) => state.entities.teams.teams[teamId]?.name);
    const mentionKeys = useSelector(getCurrentUserMentionKeys);
    const lastReceived = useSelector((state: GlobalState) => (state.views as any).activity?.lastReceived as ReceivedReaction | null);
    const lastMention = useSelector((state: GlobalState) => (state.views as any).activity?.lastMention as Post | null);
    const [items, setItems] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const mentionTerms = useMemo(() => {
        return mentionKeys.
            filter(({key}) => key !== '@channel' && key !== '@all' && key !== '@here').
            map(({key}) => key).
            join(' ').
            trim();
    }, [mentionKeys]);

    const fetchActivity = useCallback(async () => {
        if (!userId || !teamId) {
            return;
        }
        try {
            setLoading(true);
            const reactionsPromise = Client4.getReceivedReactions(userId, teamId, 30);
            const mentionsPromise = mentionTerms ?
                Client4.searchPostsWithParams(teamId, {terms: mentionTerms, is_or_search: true, page: 0, per_page: 30}) :
                Promise.resolve({posts: {}, order: [], matches: {}, has_next: false} as any);

            const [reactions, mentions] = await Promise.all([reactionsPromise, mentionsPromise]);

            const merged: ActivityItem[] = [];

            // Group reactions by post: multiple reactions on the same post become one card.
            const groupByPost = new Map<string, ReactionGroup>();
            for (const r of reactions || []) {
                let g = groupByPost.get(r.post_id);
                if (!g) {
                    g = {
                        postId: r.post_id,
                        channelId: r.channel_id,
                        postMessage: r.post_message,
                        latestCreateAt: r.create_at,
                        emojis: [],
                        distinctUsers: [],
                    };
                    groupByPost.set(r.post_id, g);
                }
                if (r.create_at > g.latestCreateAt) {
                    g.latestCreateAt = r.create_at;
                }
                if (!g.distinctUsers.includes(r.user_id)) {
                    g.distinctUsers.push(r.user_id);
                }
                let bucket = g.emojis.find((e) => e.name === r.emoji_name);
                if (!bucket) {
                    bucket = {name: r.emoji_name, userIds: []};
                    g.emojis.push(bucket);
                }
                if (!bucket.userIds.includes(r.user_id)) {
                    bucket.userIds.push(r.user_id);
                }
            }
            for (const g of groupByPost.values()) {
                merged.push({
                    kind: 'reaction',
                    key: `r-${g.postId}`,
                    createAt: g.latestCreateAt,
                    data: g,
                });
            }

            const mentionPosts = (mentions as any).posts || {};
            const mentionOrder: string[] = (mentions as any).order || [];
            for (const postId of mentionOrder) {
                const post: Post | undefined = mentionPosts[postId];
                if (!post || post.user_id === userId || post.delete_at) {
                    continue;
                }
                merged.push({
                    kind: 'mention',
                    key: `m-${post.id}`,
                    createAt: post.create_at,
                    data: post,
                });
            }

            merged.sort((a, b) => b.createAt - a.createAt);
            setItems(merged);
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to load activity');
        } finally {
            setLoading(false);
        }
    }, [userId, teamId, mentionTerms]);

    // Initial fetch + reset unread count on open.
    useEffect(() => {
        fetchActivity();
        dispatch({type: ActionTypes.ACTIVITY_MARK_READ});
    }, [fetchActivity, dispatch]);

    // Live update: merge new reaction into the existing post group, or prepend a new
    // group if this is the first reaction on the post.
    useEffect(() => {
        if (!lastReceived) {
            return;
        }
        setItems((prev) => {
            const newKey = `r-${lastReceived.post_id}`;
            const existingIdx = prev.findIndex((it) => it.key === newKey);
            if (existingIdx !== -1) {
                const existing = prev[existingIdx];
                if (existing.kind !== 'reaction') {
                    return prev;
                }
                const g = existing.data;
                // Dedupe: skip if this exact (user, emoji) pair already counted.
                const bucket = g.emojis.find((e) => e.name === lastReceived.emoji_name);
                if (bucket?.userIds.includes(lastReceived.user_id)) {
                    return prev;
                }
                const updated: ReactionGroup = {
                    ...g,
                    latestCreateAt: Math.max(g.latestCreateAt, lastReceived.create_at),
                    distinctUsers: g.distinctUsers.includes(lastReceived.user_id) ? g.distinctUsers : [...g.distinctUsers, lastReceived.user_id],
                    emojis: bucket ?
                        g.emojis.map((e) => (e.name === lastReceived.emoji_name ? {...e, userIds: [...e.userIds, lastReceived.user_id]} : e)) :
                        [...g.emojis, {name: lastReceived.emoji_name, userIds: [lastReceived.user_id]}],
                };
                const next = [...prev];
                next.splice(existingIdx, 1);
                return [{...existing, createAt: updated.latestCreateAt, data: updated}, ...next];
            }
            const newGroup: ReactionGroup = {
                postId: lastReceived.post_id,
                channelId: lastReceived.channel_id,
                postMessage: lastReceived.post_message,
                latestCreateAt: lastReceived.create_at,
                emojis: [{name: lastReceived.emoji_name, userIds: [lastReceived.user_id]}],
                distinctUsers: [lastReceived.user_id],
            };
            return [{kind: 'reaction', key: newKey, createAt: lastReceived.create_at, data: newGroup}, ...prev];
        });
        dispatch({type: ActionTypes.ACTIVITY_MARK_READ});
    }, [lastReceived, dispatch]);

    // Live update: prepend any new mention received via WebSocket while panel is open.
    useEffect(() => {
        if (!lastMention) {
            return;
        }
        setItems((prev) => {
            const newKey = `m-${lastMention.id}`;
            if (prev.some((it) => it.key === newKey)) {
                return prev;
            }
            const newItem: ActivityItem = {
                kind: 'mention',
                key: newKey,
                createAt: lastMention.create_at,
                data: lastMention,
            };
            return [newItem, ...prev];
        });
        dispatch({type: ActionTypes.ACTIVITY_MARK_READ});
    }, [lastMention, dispatch]);

    const jumpToPost = useCallback((postId: string) => {
        if (teamName) {
            getHistory().push(`/${teamName}/pl/${postId}`);
        }
    }, [teamName]);

    return (
        <div className='ActivityRhs sidebar--right__body'>
            <div className='ActivityRhs__header'>
                <h2 className='ActivityRhs__title'>
                    <FormattedMessage
                        id='activity.rhs.title'
                        defaultMessage='Activity'
                    />
                </h2>
                <p className='ActivityRhs__subtitle'>
                    <FormattedMessage
                        id='activity.rhs.subtitle'
                        defaultMessage='Recent mentions and reactions to your messages'
                    />
                </p>
            </div>
            <div className='ActivityRhs__list'>
                {loading && (
                    <div className='ActivityRhs__empty'>
                        <FormattedMessage
                            id='activity.rhs.loading'
                            defaultMessage='Loading...'
                        />
                    </div>
                )}
                {!loading && error && (
                    <div className='ActivityRhs__empty'>
                        {error}
                    </div>
                )}
                {!loading && !error && items.length === 0 && (
                    <div className='ActivityRhs__empty'>
                        <FormattedMessage
                            id='activity.rhs.empty'
                            defaultMessage='No recent activity'
                        />
                    </div>
                )}
                {!loading && !error && items.map((item) => {
                    if (item.kind === 'reaction') {
                        const g = item.data;
                        const primaryEmoji = g.emojis[0]?.name;
                        return (
                            <button
                                key={item.key}
                                className='ActivityRhs__item'
                                onClick={() => jumpToPost(g.postId)}
                            >
                                <div className='ActivityRhs__line'>
                                    <ReactorsHeader userIds={g.distinctUsers}/>
                                </div>
                                <div className='ActivityRhs__sub'>
                                    {primaryEmoji ? `:${primaryEmoji}: ` : ''}
                                    <FormattedMessage
                                        id='activity.rhs.reactedIn'
                                        defaultMessage='Reacted in '
                                    />
                                    <ChannelName channelId={g.channelId}/>
                                </div>
                                <div className='ActivityRhs__snippet'>
                                    <strong>{'You: '}</strong>
                                    {truncate(g.postMessage)}
                                </div>
                                <div className='ActivityRhs__emojiList'>
                                    {g.emojis.map((e) => (
                                        <EmojiCountButton
                                            key={e.name}
                                            emojiName={e.name}
                                            userIds={e.userIds}
                                        />
                                    ))}
                                </div>
                                <div className='ActivityRhs__meta'>
                                    <RelativeTime createAt={g.latestCreateAt}/>
                                </div>
                            </button>
                        );
                    }

                    const p = item.data;
                    return (
                        <button
                            key={item.key}
                            className='ActivityRhs__item'
                            onClick={() => jumpToPost(p.id)}
                        >
                            <div className='ActivityRhs__line'>
                                <UserName userId={p.user_id}/>
                                <FormattedMessage
                                    id='activity.rhs.mentionedYou'
                                    defaultMessage=' mentioned you in '
                                />
                                <ChannelName channelId={p.channel_id}/>
                            </div>
                            <div className='ActivityRhs__snippet'>{truncate(p.message)}</div>
                            <div className='ActivityRhs__meta'>
                                <RelativeTime createAt={p.create_at}/>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ActivityRhs;
