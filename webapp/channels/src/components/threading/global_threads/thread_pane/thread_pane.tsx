// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback} from 'react';
import type {ReactNode} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import type {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';

import {setThreadFollow} from 'mattermost-redux/actions/threads';
import {makeGetChannel, getAllChannelStats} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost, makeGetPostsForThread} from 'mattermost-redux/selectors/entities/posts';

import {showPinnedPosts, showChannelMembers, closeRightHandSide} from 'actions/views/rhs';
import {focusPost} from 'components/permalink_view/actions';
import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import PopoutButton from 'components/popout_button';
import Header from 'components/widgets/header';
import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';
import {popoutThread} from 'utils/popouts/popout_windows';

import {getRhsState} from 'selectors/rhs';

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
    if (cleaned.length > 60) {
        cleaned = cleaned.substring(0, 60) + '...';
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

    // Channel stats for pins and members count
    const channelStats = useSelector((state: GlobalState) => getAllChannelStats(state)[channelId]);
    const pinnedPostsCount = channelStats?.pinnedpost_count || 0;
    const memberCount = channelStats?.member_count || 0;

    // RHS state for active button styling
    const rhsState = useSelector(getRhsState);

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

    // Handlers for Pins and Members buttons (ThreadsInSidebar feature)
    const showPinnedPostsHandler = useCallback(() => {
        if (rhsState === RHSStates.PIN) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showPinnedPosts(channelId));
        }
    }, [dispatch, channelId, rhsState]);

    const showChannelMembersHandler = useCallback(() => {
        if (rhsState === RHSStates.CHANNEL_MEMBERS) {
            dispatch(closeRightHandSide());
        } else {
            dispatch(showChannelMembers(channelId));
        }
    }, [dispatch, channelId, rhsState]);

    // Get thread name from root post message
    const threadName = post ? cleanMessageForDisplay(post.message) : '';

    // Pinned and Members button classes (ThreadsInSidebar feature)
    const pinnedIconClass = classNames('channel-header__icon channel-header__icon--wide channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': rhsState === RHSStates.PIN,
    });
    const membersIconClass = classNames('member-rhs__trigger channel-header__icon channel-header__icon--wide channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': rhsState === RHSStates.CHANNEL_MEMBERS,
    });

    // Render enhanced header when ThreadsInSidebar is enabled
    const renderHeading = () => {
        if (isThreadsInSidebarEnabled && threadName) {
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
                            <span className='ThreadPane__header-text'>{threadName}</span>
                        </h3>
                        <div className='ThreadPane__header-icons'>
                            <HeaderIconWrapper
                                tooltip={formatMessage({id: 'channel_header.channelMembers', defaultMessage: 'Members'})}
                                buttonClass={membersIconClass}
                                buttonId={'threadPaneMembersButton'}
                                onClick={showChannelMembersHandler}
                            >
                                <i
                                    aria-hidden='true'
                                    className='icon icon-account-outline channel-header__members'
                                />
                                <span
                                    id='threadPaneMemberCountText'
                                    className='icon__text'
                                >
                                    {memberCount || '-'}
                                </span>
                            </HeaderIconWrapper>
                            {pinnedPostsCount > 0 && (
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
                                    <span
                                        id='threadPanePinnedPostCountText'
                                        className='icon__text'
                                    >
                                        {pinnedPostsCount}
                                    </span>
                                </HeaderIconWrapper>
                            )}
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
