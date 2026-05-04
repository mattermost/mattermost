// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
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

// Hard caps so the feed stays bounded across a long session: WS events keep
// prepending into the local arrays and accumulators merge multiple sources.
const MAX_FEED_ITEMS = 30;
const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type ActivityFeedItem =
    | {kind: 'reaction'; key: string; createAt: number; group: ReactionGroup}
    | {kind: 'mention'; key: string; createAt: number; post: Post};

const truncate = (text: string, max = 200) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
};

// Detect a real @here/@channel/@all broadcast in a post body. Strips fenced and
// inline code blocks so quoted examples don't match, and rejects URL-like
// "@here.com" patterns (`.<word>` follow).
const BROADCAST_RE = /(?:^|[^\w@])@(?:here|channel|all)(?!\w)(?!\.\w)/i;
const isBroadcastMessage = (message: string | undefined): boolean => {
    if (!message) {
        return false;
    }
    const stripped = message.
        replace(/```[\s\S]*?```/g, '').
        replace(/`[^`\n]*`/g, '');
    return BROADCAST_RE.test(stripped);
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
    const isBroadcast = isBroadcastMessage(post.message);

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
                    {isBroadcast ? (
                        <FormattedMessage
                            id='activity.page.channelMentionIn'
                            defaultMessage='Channel mention in'
                        />
                    ) : (
                        <FormattedMessage
                            id='activity.page.mentionedYouIn'
                            defaultMessage='Mentioned you in'
                        />
                    )}
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

    // Tracks the latest fetch invocation. If the user navigates away/back or
    // switches teams while an earlier fetch is in flight, its result is dropped
    // instead of clobbering newer state.
    const fetchTokenRef = useRef(0);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Activity));
        dispatch(suppressRHS);
        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    useEffect(() => {
        return () => {
            // Bump on unmount so any in-flight fetch resolves into a stale token.
            fetchTokenRef.current += 1;
        };
    }, []);

    const mentionTerms = useMemo(() => {
        // Personal keys only — broadcast mentions (@here/@channel/@all) come from a
        // dedicated endpoint because Postgres FTS treats `here` and `all` as stopwords
        // and cannot match them via the regular search API.
        const keys = mentionKeys.
            filter(({key}) => key !== '@channel' && key !== '@all' && key !== '@here').
            map(({key}) => key).
            join(' ').
            trim();
        if (!keys) {
            return '';
        }
        // Restrict the FTS search to the last 7 days so a quiet user doesn't see
        // 3-week-old mentions surface. Mattermost search supports the `after:`
        // modifier with YYYY-MM-DD; pad backwards an extra day to be safe across
        // server timezone boundaries.
        const after = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000));
        const yyyy = after.getUTCFullYear();
        const mm = String(after.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(after.getUTCDate()).padStart(2, '0');
        return `${keys} after:${yyyy}-${mm}-${dd}`;
    }, [mentionKeys]);

    const fetchActivity = useCallback(() => {
        if (!userId || !teamId) {
            return;
        }
        fetchTokenRef.current += 1;
        const myToken = fetchTokenRef.current;
        setLoading(true);
        setError(null);

        // Render-as-arrives: each source updates state independently the moment its
        // promise resolves, so the user sees the fastest source (usually reactions)
        // immediately rather than waiting on the slowest (broadcast ILIKE scan).
        const isFresh = () => myToken === fetchTokenRef.current;
        const personalMentionsAccum = new Map<string, Post>();
        const broadcastMentionsAccum = new Map<string, Post>();

        const recomputeMentions = () => {
            const seen = new Set<string>();
            const merged: Post[] = [];
            const pushPost = (post: Post | undefined) => {
                if (!post || post.user_id === userId || post.delete_at || seen.has(post.id)) {
                    return;
                }
                seen.add(post.id);
                merged.push(post);
            };
            for (const p of personalMentionsAccum.values()) {
                pushPost(p);
            }
            for (const p of broadcastMentionsAccum.values()) {
                pushPost(p);
            }
            setMentions(merged);
        };

        // Loading spinner stays up until either:
        //   (a) some source has returned non-empty data — render what we have, drop
        //       the spinner; subsequent sources merge in as they arrive, or
        //   (b) all 3 sources have settled — even if feed is empty, hide spinner
        //       so the "No recent activity" state can show.
        // This avoids the flicker where an empty fast source unmasks the empty
        // state before the slower source delivers data.
        let pending = 3;
        let hasData = false;
        const stopLoadingIfReady = () => {
            if (!isFresh()) {
                return;
            }
            if (hasData || pending === 0) {
                setLoading(false);
            }
        };
        const markData = (count: number) => {
            if (count > 0) {
                hasData = true;
            }
        };
        const settle = () => {
            if (!isFresh()) {
                return;
            }
            pending -= 1;
            stopLoadingIfReady();
        };

        Client4.getReceivedReactions(userId, teamId, 10).
            then((res) => {
                if (!isFresh()) {
                    return;
                }
                const list = res || [];
                setReactions(list);
                markData(list.length);
                stopLoadingIfReady();
            }).
            catch((err) => {
                if (!isFresh()) {
                    return;
                }
                setError((prev) => prev ?? err?.message ?? 'Failed to load reactions');
            }).
            finally(settle);

        const mentionsPromise = mentionTerms ?
            Client4.searchPostsWithParams(teamId, {terms: mentionTerms, is_or_search: true, page: 0, per_page: 10}) :
            Promise.resolve({posts: {}, order: [], matches: {}, has_next: false} as any);
        mentionsPromise.
            then((res) => {
                if (!isFresh()) {
                    return;
                }
                const posts = (res as any).posts || {};
                const order: string[] = (res as any).order || [];
                personalMentionsAccum.clear();
                for (const id of order) {
                    const p: Post | undefined = posts[id];
                    if (p) {
                        personalMentionsAccum.set(p.id, p);
                    }
                }
                recomputeMentions();
                markData(personalMentionsAccum.size);
                stopLoadingIfReady();
            }).
            catch((err) => {
                if (!isFresh()) {
                    return;
                }
                setError((prev) => prev ?? err?.message ?? 'Failed to load mentions');
            }).
            finally(settle);

        Client4.getBroadcastMentions(userId, teamId, 10).
            then((res) => {
                if (!isFresh()) {
                    return;
                }
                broadcastMentionsAccum.clear();
                for (const p of res || []) {
                    broadcastMentionsAccum.set(p.id, p);
                }
                recomputeMentions();
                markData(broadcastMentionsAccum.size);
                stopLoadingIfReady();
            }).
            catch((err) => {
                if (!isFresh()) {
                    return;
                }
                setError((prev) => prev ?? err?.message ?? 'Failed to load broadcast mentions');
            }).
            finally(settle);
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
            return [lastReceived, ...prev].slice(0, MAX_FEED_ITEMS);
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
            return [lastMention, ...prev].slice(0, MAX_FEED_ITEMS);
        });
        dispatch({type: ActionTypes.ACTIVITY_MARK_READ});
    }, [lastMention, dispatch]);

    const groups = useMemo(() => groupReactions(reactions), [reactions]);

    const feed = useMemo<ActivityFeedItem[]>(() => {
        const items: ActivityFeedItem[] = [];
        // Drop anything older than the activity window so a quiet user doesn't see
        // 3-week-old mentions surface (the search API has no date filter).
        const cutoff = Date.now() - ACTIVITY_WINDOW_MS;
        for (const g of groups) {
            if (g.latestCreateAt < cutoff) {
                continue;
            }
            items.push({kind: 'reaction', key: `r-${g.postId}`, createAt: g.latestCreateAt, group: g});
        }
        for (const p of mentions) {
            if (p.create_at < cutoff) {
                continue;
            }
            items.push({kind: 'mention', key: `m-${p.id}`, createAt: p.create_at, post: p});
        }
        items.sort((a, b) => b.createAt - a.createAt);
        // Final cap so the rendered feed never grows beyond the configured size,
        // even if accumulated WS events would otherwise stretch it.
        return items.slice(0, MAX_FEED_ITEMS);
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

    // Hydrate channels referenced. We compute the missing-channel subset inside a
    // memoized selector so the effect only re-runs when an *unknown* channel id
    // appears, not whenever any channel anywhere in the store changes.
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

    const missingChannelIds = useSelector((state: GlobalState) => {
        const channels = state.entities.channels.channels;
        const missing: string[] = [];
        for (const cid of channelIds) {
            if (cid && !channels[cid]) {
                missing.push(cid);
            }
        }
        return missing;
    }, (a, b) => a.length === b.length && a.every((v, i) => v === b[i]));

    useEffect(() => {
        for (const cid of missingChannelIds) {
            dispatch(fetchChannel(cid));
        }
    }, [dispatch, missingChannelIds]);

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
