// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {getCustomEmojisByName} from 'mattermost-redux/actions/emojis';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getChannel as selectChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getCurrentUserMentionKeys, getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';

import RenderEmoji from 'components/emoji/render_emoji';
import Timestamp from 'components/timestamp';
import WithTooltip from 'components/with_tooltip';
import Avatar from 'components/widgets/users/avatar/avatar';

import {getHistory} from 'utils/browser_history';
import {ActionTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import './activity.scss';

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
    latestReactorId: string;
    uniqueReactorIds: string[];
    emojiCounts: Array<{emoji: string; userIds: string[]}>;
};

const TIMESTAMP_OPTS = {
    units: ['now' as const, 'minute' as const, 'hour' as const, 'day' as const, 'week' as const],
    useTime: false,
    day: 'numeric' as const,
};

type ActivityFeedItem =
    | {kind: 'reaction'; key: string; createAt: number; group: ReactionGroup}
    | {kind: 'mention'; key: string; createAt: number; post: Post};

const truncate = (text: string, max = 200) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
};

const channelIconClass = (type?: string) => {
    switch (type) {
    case 'P':
        return 'icon-lock-outline';
    case 'D':
        return 'icon-account-outline';
    case 'G':
        return 'icon-account-multiple-outline';
    case 'O':
    default:
        return 'icon-globe';
    }
};

const groupReactions = (reactions: ReceivedReaction[]): ReactionGroup[] => {
    const byPost = new Map<string, ReactionGroup>();

    const sorted = [...reactions].sort((a, b) => b.create_at - a.create_at);

    for (const r of sorted) {
        let group = byPost.get(r.post_id);
        if (!group) {
            group = {
                postId: r.post_id,
                channelId: r.channel_id,
                postMessage: r.post_message,
                latestCreateAt: r.create_at,
                latestReactorId: r.user_id,
                uniqueReactorIds: [],
                emojiCounts: [],
            };
            byPost.set(r.post_id, group);
        }

        if (!group.uniqueReactorIds.includes(r.user_id)) {
            group.uniqueReactorIds.push(r.user_id);
        }

        const existing = group.emojiCounts.find((e) => e.emoji === r.emoji_name);
        if (existing) {
            if (!existing.userIds.includes(r.user_id)) {
                existing.userIds.push(r.user_id);
            }
        } else {
            group.emojiCounts.push({emoji: r.emoji_name, userIds: [r.user_id]});
        }
    }

    return Array.from(byPost.values());
};

type ChannelLineProps = {
    channelId: string;
};

const ChannelChip = ({channelId}: ChannelLineProps) => {
    const channel = useSelector((state: GlobalState) => selectChannel(state, channelId));
    if (!channel?.display_name) {
        return null;
    }
    return (
        <span className='Activity__channel'>
            <i className={`icon ${channelIconClass(channel?.type)}`}/>
            <span>{channel.display_name}</span>
        </span>
    );
};

type ReactionChipProps = {
    emoji: string;
    userIds: string[];
};

const ReactionChip = ({emoji, userIds}: ReactionChipProps) => {
    const intl = useIntl();
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const users = useSelector((state: GlobalState) => userIds.map((id) => getUser(state, id)));

    const names = userIds.map((id, idx) => {
        const u = users[idx];
        return u ? displayUsername(u, teammateNameDisplaySetting) : id;
    });

    let label: string;
    if (names.length === 1) {
        label = names[0];
    } else if (names.length === 2) {
        label = `${names[0]} and ${names[1]}`;
    } else {
        label = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    }

    const tooltipTitle = intl.formatMessage(
        {
            id: 'activity.page.reactedWith',
            defaultMessage: '{users} reacted with :{emoji}:',
        },
        {users: label, emoji},
    );

    return (
        <WithTooltip
            title={tooltipTitle}
            emoji={emoji}
            isEmojiLarge={true}
        >
            <span className='Activity__chip'>
                <RenderEmoji
                    emojiName={emoji}
                    size={16}
                />
                <span>{userIds.length}</span>
            </span>
        </WithTooltip>
    );
};

type ReactionItemProps = {
    group: ReactionGroup;
    onJump: (postId: string) => void;
};

const ReactionItem = ({group, onJump}: ReactionItemProps) => {
    const reactor = useSelector((state: GlobalState) => getUser(state, group.latestReactorId));
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);

    const reactorName = reactor ? displayUsername(reactor, teammateNameDisplaySetting) : group.latestReactorId;
    const avatarUrl = reactor ? Client4.getProfilePictureUrl(reactor.id, reactor.last_picture_update) : undefined;
    const otherCount = group.uniqueReactorIds.length - 1;

    return (
        <button
            className='Activity__item'
            onClick={() => onJump(group.postId)}
        >
            <div className='Activity__avatar'>
                <Avatar
                    size='lg'
                    url={avatarUrl}
                    username={reactor?.username}
                />
            </div>
            <div className='Activity__main'>
                <div className='Activity__topline'>
                    <span className='Activity__name'>
                        {otherCount > 0 ? (
                            <FormattedMessage
                                id='activity.page.nameAndOthers'
                                defaultMessage='{name} & {count, plural, one {# other} other {# others}}'
                                values={{name: reactorName, count: otherCount}}
                            />
                        ) : reactorName}
                    </span>
                    <span className='Activity__date'>
                        <Timestamp
                            value={group.latestCreateAt}
                            {...TIMESTAMP_OPTS}
                        />
                    </span>
                </div>
                <div className='Activity__reactedin'>
                    <RenderEmoji
                        emojiName={group.emojiCounts[0]?.emoji}
                        size={16}
                    />
                    <FormattedMessage
                        id='activity.page.reactedIn'
                        defaultMessage='Reacted in'
                    />
                    <ChannelChip channelId={group.channelId}/>
                </div>
                <div className='Activity__snippet'>
                    <FormattedMessage
                        id='activity.page.youPrefix'
                        defaultMessage='You:'
                    />
                    <span>{` ${truncate(group.postMessage)}`}</span>
                </div>
                <div className='Activity__chips'>
                    {group.emojiCounts.map((e) => (
                        <ReactionChip
                            key={e.emoji}
                            emoji={e.emoji}
                            userIds={e.userIds}
                        />
                    ))}
                </div>
            </div>
        </button>
    );
};

type MentionItemProps = {
    post: Post;
    onJump: (postId: string) => void;
};

const MentionItem = ({post, onJump}: MentionItemProps) => {
    const author = useSelector((state: GlobalState) => getUser(state, post.user_id));
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);

    const authorName = author ? displayUsername(author, teammateNameDisplaySetting) : post.user_id;
    const avatarUrl = author ? Client4.getProfilePictureUrl(author.id, author.last_picture_update) : undefined;

    return (
        <button
            className='Activity__item'
            onClick={() => onJump(post.id)}
        >
            <div className='Activity__avatar'>
                <Avatar
                    size='lg'
                    url={avatarUrl}
                    username={author?.username}
                />
            </div>
            <div className='Activity__main'>
                <div className='Activity__topline'>
                    <span className='Activity__name'>{authorName}</span>
                    <span className='Activity__date'>
                        <Timestamp
                            value={post.create_at}
                            {...TIMESTAMP_OPTS}
                        />
                    </span>
                </div>
                <div className='Activity__reactedin'>
                    <i className='icon icon-at'/>
                    <FormattedMessage
                        id='activity.page.mentionedYouIn'
                        defaultMessage='Mentioned you in'
                    />
                    <ChannelChip channelId={post.channel_id}/>
                </div>
                <div className='Activity__snippet Activity__snippet--mention'>
                    {truncate(post.message)}
                </div>
            </div>
        </button>
    );
};

function Activity() {
    const dispatch = useDispatch();
    const userId = useSelector(getCurrentUserId);
    const teamId = useSelector(getCurrentTeamId);
    const teamName = useSelector((state: GlobalState) => state.entities.teams.teams[teamId]?.name);
    const mentionKeys = useSelector(getCurrentUserMentionKeys);
    const lastReceived = useSelector((state: GlobalState) => (state.views as any).activity?.lastReceived as ReceivedReaction | null);
    const lastMention = useSelector((state: GlobalState) => (state.views as any).activity?.lastMention as Post | null);

    const [reactions, setReactions] = useState<ReceivedReaction[]>([]);
    const [mentions, setMentions] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Activity));
        dispatch(suppressRHS);
        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

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
            const reactionsPromise = Client4.getReceivedReactions(userId, teamId, 50);
            const mentionsPromise = mentionTerms ?
                Client4.searchPostsWithParams(teamId, {terms: mentionTerms, is_or_search: true, page: 0, per_page: 50}) :
                Promise.resolve({posts: {}, order: [], matches: {}, has_next: false} as any);

            const [reactionsResult, mentionsResult] = await Promise.all([reactionsPromise, mentionsPromise]);
            setReactions(reactionsResult || []);

            const mentionPosts = (mentionsResult as any).posts || {};
            const mentionOrder: string[] = (mentionsResult as any).order || [];
            const mentionList: Post[] = [];
            for (const postId of mentionOrder) {
                const post: Post | undefined = mentionPosts[postId];
                if (!post || post.user_id === userId || post.delete_at) {
                    continue;
                }
                mentionList.push(post);
            }
            setMentions(mentionList);
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to load activity');
        } finally {
            setLoading(false);
        }
    }, [userId, teamId, mentionTerms]);

    useEffect(() => {
        fetchActivity();
        dispatch({type: ActionTypes.ACTIVITY_MARK_READ});
    }, [fetchActivity, dispatch]);

    useEffect(() => {
        if (!lastReceived) {
            return;
        }
        setReactions((prev) => {
            const dupKey = `${lastReceived.user_id}-${lastReceived.post_id}-${lastReceived.emoji_name}-${lastReceived.create_at}`;
            if (prev.some((r) => `${r.user_id}-${r.post_id}-${r.emoji_name}-${r.create_at}` === dupKey)) {
                return prev;
            }
            return [lastReceived, ...prev];
        });
        dispatch({type: ActionTypes.ACTIVITY_MARK_READ});
    }, [lastReceived, dispatch]);

    useEffect(() => {
        if (!lastMention) {
            return;
        }
        setMentions((prev) => {
            if (prev.some((p) => p.id === lastMention.id)) {
                return prev;
            }
            return [lastMention, ...prev];
        });
        dispatch({type: ActionTypes.ACTIVITY_MARK_READ});
    }, [lastMention, dispatch]);

    const groups = useMemo(() => groupReactions(reactions), [reactions]);

    const feed = useMemo<ActivityFeedItem[]>(() => {
        const items: ActivityFeedItem[] = [];
        for (const g of groups) {
            items.push({kind: 'reaction', key: `r-${g.postId}`, createAt: g.latestCreateAt, group: g});
        }
        for (const p of mentions) {
            items.push({kind: 'mention', key: `m-${p.id}`, createAt: p.create_at, post: p});
        }
        items.sort((a, b) => b.createAt - a.createAt);
        return items;
    }, [groups, mentions]);

    // Hydrate user profiles referenced by the feed.
    const userIds = useMemo(() => {
        const ids = new Set<string>();
        for (const g of groups) {
            for (const id of g.uniqueReactorIds) {
                ids.add(id);
            }
        }
        for (const p of mentions) {
            if (p.user_id) {
                ids.add(p.user_id);
            }
        }
        return Array.from(ids);
    }, [groups, mentions]);

    useEffect(() => {
        if (userIds.length > 0) {
            dispatch(getMissingProfilesByIds(userIds));
        }
    }, [dispatch, userIds]);

    // Hydrate channels referenced.
    const channelIds = useMemo(() => {
        const ids = new Set<string>();
        for (const g of groups) {
            ids.add(g.channelId);
        }
        for (const p of mentions) {
            ids.add(p.channel_id);
        }
        return Array.from(ids);
    }, [groups, mentions]);
    const knownChannels = useSelector((state: GlobalState) => state.entities.channels.channels);
    useEffect(() => {
        channelIds.forEach((cid) => {
            if (cid && !knownChannels[cid]) {
                dispatch(fetchChannel(cid));
            }
        });
    }, [dispatch, channelIds, knownChannels]);

    // Hydrate custom emojis used in reactions.
    const emojiNames = useMemo(() => {
        const set = new Set<string>();
        for (const g of groups) {
            for (const e of g.emojiCounts) {
                set.add(e.emoji);
            }
        }
        return Array.from(set);
    }, [groups]);
    useEffect(() => {
        if (emojiNames.length > 0) {
            dispatch(getCustomEmojisByName(emojiNames));
        }
    }, [dispatch, emojiNames]);

    const jumpToPost = useCallback((postId: string) => {
        if (teamName) {
            getHistory().push(`/${teamName}/pl/${postId}`);
        }
    }, [teamName]);

    return (
        <div className='Activity app__content'>
            <header className='Activity__header'>
                <h1 className='Activity__heading'>
                    <FormattedMessage
                        id='activity.page.title'
                        defaultMessage='Activity'
                    />
                </h1>
                <p className='Activity__subheading'>
                    <FormattedMessage
                        id='activity.page.subtitle'
                        defaultMessage='Recent reactions and mentions'
                    />
                </p>
            </header>

            <div className='Activity__list'>
                {loading && (
                    <div className='Activity__empty'>
                        <FormattedMessage
                            id='activity.page.loading'
                            defaultMessage='Loading...'
                        />
                    </div>
                )}
                {!loading && error && (
                    <div className='Activity__empty'>
                        {error}
                    </div>
                )}
                {!loading && !error && feed.length === 0 && (
                    <div className='Activity__empty'>
                        <FormattedMessage
                            id='activity.page.empty'
                            defaultMessage='No recent activity'
                        />
                    </div>
                )}
                {!loading && !error && feed.map((item) => {
                    if (item.kind === 'reaction') {
                        return (
                            <ReactionItem
                                key={item.key}
                                group={item.group}
                                onJump={jumpToPost}
                            />
                        );
                    }
                    return (
                        <MentionItem
                            key={item.key}
                            post={item.post}
                            onJump={jumpToPost}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default memo(Activity);
