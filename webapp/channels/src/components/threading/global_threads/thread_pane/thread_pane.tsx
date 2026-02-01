// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import type {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';

import {Client4} from 'mattermost-redux/client';
import {setThreadFollow} from 'mattermost-redux/actions/threads';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost, makeGetPostsForThread} from 'mattermost-redux/selectors/entities/posts';

import {showThreadPinnedPosts, showThreadFollowers, closeRightHandSide} from 'actions/views/rhs';
import {focusPost} from 'components/permalink_view/actions';
import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import PopoutButton from 'components/popout_button';
import Header from 'components/widgets/header';
import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';
import {popoutThread} from 'utils/popouts/popout_windows';

import {getRhsState, getPinnedPostsThreadId, getThreadFollowersThreadId} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import Button from '../../common/button';
import FollowButton from '../../common/follow_button';
import {useThreadRouting} from '../../hooks';
import ThreadMenu from '../thread_menu';

import './thread_pane.scss';

// Clean up message text for display in header
function cleanMessageForDisplay(message: string): string {
    if (!message) {
        return '';
    }

    let cleaned = message.

        // Remove code blocks
        replace(/```[\s\S]*?```/g, '[code]').
        replace(/`[^`]+`/g, '[code]').

        // Remove links but keep text
        replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').

        // Remove images
        replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]').

        // Remove bold/italic
        replace(/\*\*([^*]+)\*\*/g, '$1').
        replace(/\*([^*]+)\*/g, '$1').
        replace(/__([^_]+)__/g, '$1').
        replace(/_([^_]+)_/g, '$1').

        // Remove headers
        replace(/^#+\s+/gm, '').

        // Remove blockquotes
        replace(/^>\s+/gm, '').

        // Remove horizontal rules
        replace(/^---+$/gm, '').

        // Collapse whitespace
        replace(/\s+/g, ' ').
        trim();

    // Truncate if too long
    if (cleaned.length > 30) {
        cleaned = cleaned.substring(0, 30) + '...';
    }

    return cleaned;
}

const getChannel = makeGetChannel();
const getPostsForThread = makeGetPostsForThread();

type Props = {
    thread: UserThread | UserThreadSynthetic;
    children?: ReactNode;
};

const ThreadPane = ({
    thread,
    children,
}: Props) => {
    const intl = useIntl();
    const {formatMessage} = intl;
    const dispatch = useDispatch();
    const {
        params: {
            team,
        },
        currentTeamId,
        currentUserId,
        goToInChannel,
        select,
    } = useThreadRouting();

    const {
        id: threadId,
        is_following: isFollowing,
        post: {
            channel_id: channelId,
        },
    } = thread;

    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const post = useSelector((state: GlobalState) => getPost(state, thread.id));
    const postsInThread = useSelector((state: GlobalState) => getPostsForThread(state, post.id));

    // ThreadsInSidebar feature flag check
    const config = useSelector(getConfig);
    const isThreadsInSidebarEnabled = (config as Record<string, string>)?.FeatureFlagThreadsInSidebar === 'true';

    // Thread followers count (fetched from API)
    const [threadFollowersCount, setThreadFollowersCount] = useState(0);

    // Thread pinned posts count (fetched from API)
    const [threadPinnedPostsCount, setThreadPinnedPostsCount] = useState(0);

    // RHS state for active button styling
    const rhsState = useSelector(getRhsState);
    const pinnedPostsThreadId = useSelector(getPinnedPostsThreadId);
    const threadFollowersThreadId = useSelector(getThreadFollowersThreadId);

    // Fetch thread followers and pinned posts count (ThreadsInSidebar feature)
    // Also refetch when rhsState changes (e.g., after adding/removing followers from RHS)
    useEffect(() => {
        if (isThreadsInSidebarEnabled && threadId) {
            // Fetch thread followers
            Client4.getThreadFollowers(threadId).then((followers) => {
                setThreadFollowersCount(followers.length);
            }).catch(() => {
                setThreadFollowersCount(0);
            });

            // Fetch thread pinned posts
            Client4.getThreadPinnedPosts(threadId).then((postList) => {
                setThreadPinnedPostsCount(postList.order?.length || 0);
            }).catch(() => {
                setThreadPinnedPostsCount(0);
            });
        }
    }, [isThreadsInSidebarEnabled, threadId, rhsState]);

    const selectHandler = useCallback(() => select(), [select]);
    let unreadTimestamp = post.edit_at || post.create_at;

    // if we have the whole thread, get the posts in it, sorted from newest to oldest.
    // First post is latest reply. Use that timestamp
    if (postsInThread.length > 1) {
        const p = postsInThread[0];
        unreadTimestamp = p.edit_at || p.create_at;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const goToInChannelHandler = useCallback(() => {
        goToInChannel(threadId);
    }, [goToInChannel, threadId]);

    const followHandler = useCallback(() => {
        dispatch(setThreadFollow(currentUserId, currentTeamId, threadId, !isFollowing));
    }, [dispatch, currentUserId, currentTeamId, threadId, isFollowing]);

    const popout = useCallback(() => {
        popoutThread(intl, threadId, team, (postId, returnTo) => {
            dispatch(focusPost(postId, returnTo, currentUserId, {skipRedirectReplyPermalink: true}));
        });
    }, [threadId, team, intl, dispatch, currentUserId]);

    // Handlers for Pins button (ThreadsInSidebar feature)
    const showPinnedPostsHandler = useCallback(() => {
        // Check if we're already showing pinned posts for this thread
        if (rhsState === RHSStates.PIN && pinnedPostsThreadId === threadId) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showThreadPinnedPosts(threadId, channelId));
        }
    }, [dispatch, channelId, threadId, rhsState, pinnedPostsThreadId]);

    // Handlers for Followers button (ThreadsInSidebar feature)
    const showThreadFollowersHandler = useCallback(() => {
        // Check if we're already showing followers for this thread
        if (rhsState === RHSStates.THREAD_FOLLOWERS && threadFollowersThreadId === threadId) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showThreadFollowers(threadId, channelId));
        }
    }, [dispatch, channelId, threadId, rhsState, threadFollowersThreadId]);

    // Get thread name from root post message
    const threadName = post ? cleanMessageForDisplay(post.message) : '';

    // Pinned button class (ThreadsInSidebar feature)
    const pinnedIconClass = classNames('channel-header__icon channel-header__icon--wide channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': rhsState === RHSStates.PIN && pinnedPostsThreadId === threadId,
    });

    // Members button class
    const membersIconClass = classNames('channel-header__icon channel-header__icon--wide channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': rhsState === RHSStates.THREAD_FOLLOWERS && threadFollowersThreadId === threadId,
    });

    // Render enhanced header when ThreadsInSidebar is enabled
    const renderHeading = () => {
        if (isThreadsInSidebarEnabled) {
            return (
                <>
                    <Button
                        className='Button___icon Button___large back'
                        onClick={selectHandler}
                    >
                        <i className='icon icon-arrow-back-ios'/>
                    </Button>
                    <div className='ThreadPane__header-title'>
                        <h3 className='ThreadPane__header-name'>
                            <span className='icon-discord-thread ThreadPane__header-icon'/>
                            <span className='ThreadPane__header-text'>{threadName || formatMessage({id: 'threading.header.heading', defaultMessage: 'Thread'})}</span>
                        </h3>
                        <div className='ThreadPane__header-icons channel-header__icons'>
                            <HeaderIconWrapper
                                buttonClass={membersIconClass}
                                buttonId={'threadPaneMembersButton'}
                                onClick={showThreadFollowersHandler}
                                tooltip={formatMessage({id: 'threading.header.followers', defaultMessage: 'Thread followers'})}
                            >
                                <i
                                    aria-hidden='true'
                                    className='icon icon-account-outline channel-header__members'
                                />
                                {threadFollowersCount > 0 && (
                                    <span
                                        id='threadPaneFollowersCountText'
                                        className='icon__text'
                                    >
                                        {threadFollowersCount}
                                    </span>
                                )}
                            </HeaderIconWrapper>
                            <HeaderIconWrapper
                                buttonClass={pinnedIconClass}
                                buttonId={'threadPanePinButton'}
                                onClick={showPinnedPostsHandler}
                                tooltip={formatMessage({id: 'channel_header.pinnedPosts', defaultMessage: 'Pinned messages'})}
                            >
                                <i
                                    aria-hidden='true'
                                    className='icon icon-pin-outline channel-header__pin'
                                />
                                {threadPinnedPostsCount > 0 && (
                                    <span
                                        id='threadPanePinnedPostCountText'
                                        className='icon__text'
                                    >
                                        {threadPinnedPostsCount}
                                    </span>
                                )}
                            </HeaderIconWrapper>
                        </div>
                    </div>
                </>
            );
        }

        // Default header when feature is disabled
        return (
            <>
                <Button
                    className='Button___icon Button___large back'
                    onClick={selectHandler}
                >
                    <i className='icon icon-arrow-back-ios'/>
                </Button>
                <h3>
                    <span className='separated'>
                        {formatMessage({
                            id: 'threading.header.heading',
                            defaultMessage: 'Thread',
                        })}
                    </span>
                    <Button
                        className='separated'
                        allowTextOverflow={true}
                        onClick={goToInChannelHandler}
                    >
                        {channel?.display_name}
                    </Button>
                </h3>
            </>
        );
    };

    return (
        <div
            id={'thread-pane-container'}
            className='ThreadPane'
        >
            <Header
                className='ThreadPane___header'
                heading={renderHeading()}
                right={(
                    <>
                        <FollowButton
                            isFollowing={isFollowing}
                            onClick={followHandler}
                        />
                        <PopoutButton onClick={popout}/>
                        <ThreadMenu
                            threadId={threadId}
                            isFollowing={isFollowing}
                            hasUnreads={isFollowing && Boolean((thread as UserThread).unread_replies || (thread as UserThread).unread_mentions)}
                            unreadTimestamp={unreadTimestamp}
                        >
                            <WithTooltip
                                title={formatMessage({
                                    id: 'threading.threadHeader.menu',
                                    defaultMessage: 'More Actions',
                                })}
                            >
                                <Button className='Button___icon Button___large'>
                                    <DotsVerticalIcon size={18}/>
                                </Button>
                            </WithTooltip>
                        </ThreadMenu>
                    </>
                )}
            />
            {children}
        </div>
    );
};

export default memo(ThreadPane);
