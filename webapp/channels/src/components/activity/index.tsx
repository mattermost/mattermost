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

type FullReactionsByPost = Record<string, Array<{user_id: string; emoji_name: string}>>;

const groupReactions = (
    reactions: ReceivedReaction[],
    fullReactions: FullReactionsByPost,
): ReactionGroup[] => {
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
    }

    // Populate emojiCounts from the FULL reactions on each post when available so
    // chips reflect the post's complete reaction state, not just the subset that
    // happened to land in the recent-received-reactions window.
    for (const group of byPost.values()) {
        const full = fullReactions[group.postId];
        if (full && full.length > 0) {
            for (const fr of full) {
                if (!group.uniqueReactorIds.includes(fr.user_id)) {
                    group.uniqueReactorIds.push(fr.user_id);
                }
                const existing = group.emojiCounts.find((e) => e.emoji === fr.emoji_name);
                if (existing) {
                    if (!existing.userIds.includes(fr.user_id)) {
                        existing.userIds.push(fr.user_id);
                    }
                } else {
                    group.emojiCounts.push({emoji: fr.emoji_name, userIds: [fr.user_id]});
                }
            }
            continue;
        }
        // Fallback: build emojiCounts from the received-reactions subset.
        for (const r of sorted) {
            if (r.post_id !== group.postId) {
                continue;
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
    // Full reaction set per post, fetched once we know which posts to display.
    // Lets reaction chips reflect every emoji on the post, not just the subset
    // that landed in the recent-received-reactions window.
    const [fullReactionsByPost, setFullReactionsByPost] = useState<FullReactionsByPost>({});

    // Pagination state for "load older" — reactions are intentionally NOT
    // paginated (cap stays at the freshest 10).
    const [hasMoreMentions, setHasMoreMentions] = useState(true);
    const [hasMoreBroadcast, setHasMoreBroadcast] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const mentionsPageRef = useRef(0);
    const broadcastCursorRef = useRef<number>(0);
    const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

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

        // Reset pagination cursors on a fresh fetch (mount / team switch).
        mentionsPageRef.current = 0;
        broadcastCursorRef.current = 0;
        setHasMoreMentions(true);
        setHasMoreBroadcast(true);

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
                // Server-side per_page is 10. Returning fewer means we exhausted
                // matches in the search window — no point asking for more.
                if (order.length < 10) {
                    setHasMoreMentions(false);
                } else {
                    mentionsPageRef.current = 1;
                }
                stopLoadingIfReady();
            }).
            catch((err) => {
                if (!isFresh()) {
                    return;
                }
                setError((prev) => prev ?? err?.message ?? 'Failed to load mentions');
            }).
            finally(settle);

        Client4.getBroadcastMentions(userId, teamId, 10, 0).
            then((res) => {
                if (!isFresh()) {
                    return;
                }
                broadcastMentionsAccum.clear();
                let oldest = Number.POSITIVE_INFINITY;
                for (const p of res || []) {
                    broadcastMentionsAccum.set(p.id, p);
                    if (p.create_at < oldest) {
                        oldest = p.create_at;
                    }
                }
                recomputeMentions();
                markData(broadcastMentionsAccum.size);
                if ((res || []).length < 10) {
                    setHasMoreBroadcast(false);
                } else {
                    broadcastCursorRef.current = oldest;
                }
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

    // Load older mentions + broadcast pages on demand. Reactions are intentionally
    // skipped — the feed always shows the freshest 10 reactions only.
    const loadMore = useCallback(async () => {
        if (!userId || !teamId) {
            return;
        }
        if (loadingMore || (!hasMoreMentions && !hasMoreBroadcast)) {
            return;
        }
        setLoadingMore(true);
        const myToken = fetchTokenRef.current;

        const tasks: Array<Promise<void>> = [];

        if (hasMoreMentions && mentionTerms) {
            const page = mentionsPageRef.current;
            tasks.push(
                Client4.searchPostsWithParams(teamId, {
                    terms: mentionTerms, is_or_search: true, page, per_page: 10,
                }).
                    then((res: any) => {
                        if (myToken !== fetchTokenRef.current) {
                            return;
                        }
                        const posts = res.posts || {};
                        const order: string[] = res.order || [];
                        if (order.length === 0) {
                            setHasMoreMentions(false);
                            return;
                        }
                        const newPosts: Post[] = [];
                        for (const id of order) {
                            const p: Post | undefined = posts[id];
                            if (p && p.user_id !== userId && !p.delete_at) {
                                newPosts.push(p);
                            }
                        }
                        setMentions((prev) => {
                            const seen = new Set(prev.map((p) => p.id));
                            const merged = [...prev];
                            for (const p of newPosts) {
                                if (!seen.has(p.id)) {
                                    seen.add(p.id);
                                    merged.push(p);
                                }
                            }
                            return merged;
                        });
                        if (order.length < 10) {
                            setHasMoreMentions(false);
                        } else {
                            mentionsPageRef.current = page + 1;
                        }
                    }).
                    catch(() => {
                        // Stop probing this source on error to avoid hammering.
                        setHasMoreMentions(false);
                    }),
            );
        }

        if (hasMoreBroadcast) {
            const before = broadcastCursorRef.current;
            tasks.push(
                Client4.getBroadcastMentions(userId, teamId, 10, before).
                    then((res) => {
                        if (myToken !== fetchTokenRef.current) {
                            return;
                        }
                        const list = res || [];
                        if (list.length === 0) {
                            setHasMoreBroadcast(false);
                            return;
                        }
                        let oldest = Number.POSITIVE_INFINITY;
                        const newPosts: Post[] = [];
                        for (const p of list) {
                            if (p.user_id === userId || p.delete_at) {
                                continue;
                            }
                            newPosts.push(p);
                            if (p.create_at < oldest) {
                                oldest = p.create_at;
                            }
                        }
                        setMentions((prev) => {
                            const seen = new Set(prev.map((p) => p.id));
                            const merged = [...prev];
                            for (const p of newPosts) {
                                if (!seen.has(p.id)) {
                                    seen.add(p.id);
                                    merged.push(p);
                                }
                            }
                            return merged;
                        });
                        if (list.length < 10) {
                            setHasMoreBroadcast(false);
                        } else {
                            broadcastCursorRef.current = oldest;
                        }
                    }).
                    catch(() => {
                        setHasMoreBroadcast(false);
                    }),
            );
        }

        await Promise.all(tasks);
        if (myToken === fetchTokenRef.current) {
            setLoadingMore(false);
        }
    }, [userId, teamId, mentionTerms, loadingMore, hasMoreMentions, hasMoreBroadcast]);

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

    // Watch the sentinel at the bottom of the feed so loadMore fires as soon as
    // it scrolls into view. The 200px rootMargin pre-fetches before the user
    // actually reaches the end, hiding the request latency.
    useEffect(() => {
        const sentinel = loadMoreSentinelRef.current;
        if (!sentinel || loading || (!hasMoreMentions && !hasMoreBroadcast)) {
            return undefined;
        }
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    loadMore();
                    break;
                }
            }
        }, {rootMargin: '200px'});
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loading, hasMoreMentions, hasMoreBroadcast, loadMore]);

    const groups = useMemo(() => groupReactions(reactions, fullReactionsByPost), [reactions, fullReactionsByPost]);

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

    // Fetch the full reaction set for any post we haven't loaded yet, in one
    // batched POST. Skips posts already cached so subsequent renders don't
    // re-request. WS reaction events keep the cached entries in sync via the
    // separate handler below.
    const reactionPostIds = useMemo(() => {
        const ids = new Set<string>();
        for (const r of reactions) {
            ids.add(r.post_id);
        }
        return Array.from(ids);
    }, [reactions]);

    useEffect(() => {
        const missing = reactionPostIds.filter((id) => !fullReactionsByPost[id]);
        if (missing.length === 0) {
            return;
        }
        let cancelled = false;
        Client4.getBulkReactionsForPosts(missing).
            then((res: any) => {
                if (cancelled) {
                    return;
                }
                setFullReactionsByPost((prev) => {
                    const next = {...prev};
                    for (const id of missing) {
                        const list = res[id] || [];
                        next[id] = list.map((r: any) => ({
                            user_id: r.user_id,
                            emoji_name: r.emoji_name,
                        }));
                    }
                    return next;
                });
            }).
            catch(() => {
                // Non-fatal: chips fall back to the received-reactions subset.
            });
        return () => {
            cancelled = true;
        };
    }, [reactionPostIds, fullReactionsByPost]);

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
                {!loading && !error && feed.length > 0 && (hasMoreMentions || hasMoreBroadcast) && (
                    <div
                        ref={loadMoreSentinelRef}
                        className='Activity__sentinel'
                    >
                        {loadingMore && (
                            <FormattedMessage
                                id='activity.page.loadingMore'
                                defaultMessage='Loading more…'
                            />
                        )}
                    </div>
                )}
                {!loading && !error && feed.length > 0 && !hasMoreMentions && !hasMoreBroadcast && (
                    <div className='Activity__sentinel Activity__sentinel--end'>
                        <FormattedMessage
                            id='activity.page.endOfFeed'
                            defaultMessage='Nothing more in the last 7 days'
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default memo(Activity);
