// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {useRouteMatch, useHistory} from 'react-router-dom';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import type {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';

import {getChannelStats} from 'mattermost-redux/actions/channels';
import {getThreadsForCurrentTeam, setThreadFollow} from 'mattermost-redux/actions/threads';
import {makeGetChannel, getAllChannelStats} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeamId, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {clearLastUnreadChannel} from 'actions/global_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';
import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS, showPinnedPosts, closeRightHandSide} from 'actions/views/rhs';
import {setSelectedThreadId} from 'actions/views/threads';
import {focusPost} from 'components/permalink_view/actions';
import ChatIllustration from 'components/common/svg_images_components/chat_illustration';
import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import LoadingScreen from 'components/loading_screen';
import Avatars from 'components/widgets/users/avatars';
import NoResultsIndicator from 'components/no_results_indicator';
import PopoutButton from 'components/popout_button';
import Header from 'components/widgets/header';
import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';
import {popoutThread} from 'utils/popouts/popout_windows';

import {getRhsState} from 'selectors/rhs';

import type {GlobalState} from 'types/store';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import Button from '../common/button';
import FollowButton from '../common/follow_button';
import ThreadMenu from '../global_threads/thread_menu';
import ThreadViewer from '../thread_viewer';

import './thread_view.scss';

// Clean up message text for display in header (same as sidebar_thread_item)
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

const ThreadView = () => {
    const intl = useIntl();
    const {formatMessage} = intl;
    const dispatch = useDispatch();
    const history = useHistory();

    const {params: {threadIdentifier}} = useRouteMatch<{team: string; threadIdentifier: string}>();
    const currentTeamId = useSelector(getCurrentTeamId);
    const currentTeam = useSelector(getCurrentTeam);
    const currentUserId = useSelector(getCurrentUserId);
    const thread = useSelector((state: GlobalState) => getThread(state, threadIdentifier)) as UserThread | UserThreadSynthetic | undefined;
    const rootPost = useSelector((state: GlobalState) => getPost(state, threadIdentifier));
    const channel = useSelector((state: GlobalState) => {
        const channelId = thread?.post?.channel_id || rootPost?.channel_id;
        return channelId ? getChannel(state, channelId) : undefined;
    });

    // ThreadsInSidebar feature flag check
    const config = useSelector(getConfig);
    const isThreadsInSidebarEnabled = (config as Record<string, string>)?.FeatureFlagThreadsInSidebar === 'true';

    // Channel stats for pins count
    const channelId = thread?.post?.channel_id || rootPost?.channel_id;
    const channelStats = useSelector((state: GlobalState) => channelId ? getAllChannelStats(state)[channelId] : undefined);
    const pinnedPostsCount = channelStats?.pinnedpost_count || 0;

    // Thread participants
    const participantIds = useMemo(() => {
        const participants = (thread as UserThread)?.participants || [];
        return participants.map(({id}) => id).reverse();
    }, [(thread as UserThread)?.participants]);

    // RHS state for active button styling
    const rhsState = useSelector(getRhsState);

    const [isLoading, setIsLoading] = useState(!thread);

    useEffect(() => {
        dispatch(suppressRHS);
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Threads));
        dispatch(clearLastUnreadChannel);
        loadProfilesForSidebar();

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    useEffect(() => {
        dispatch(setSelectedThreadId(currentTeamId, threadIdentifier));
        return () => {
            dispatch(setSelectedThreadId(currentTeamId, ''));
        };
    }, [dispatch, currentTeamId, threadIdentifier]);

    // Load threads if not already loaded
    useEffect(() => {
        if (!thread && threadIdentifier) {
            setIsLoading(true);
            dispatch(getThreadsForCurrentTeam({unread: false})).then(() => {
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [dispatch, thread, threadIdentifier]);

    // Fetch channel stats for pinned posts count (ThreadsInSidebar feature)
    useEffect(() => {
        if (isThreadsInSidebarEnabled && channelId) {
            dispatch(getChannelStats(channelId));
        }
    }, [dispatch, isThreadsInSidebarEnabled, channelId]);

    const goBack = useCallback(() => {
        // Go to the parent channel
        if (channel && currentTeam) {
            history.push(`/${currentTeam.name}/channels/${channel.name}`);
        } else {
            history.goBack();
        }
    }, [history, channel, currentTeam]);

    const goToInChannel = useCallback(() => {
        if (currentTeam) {
            history.push(`/${currentTeam.name}/pl/${threadIdentifier}`);
        }
    }, [history, currentTeam, threadIdentifier]);

    const followHandler = useCallback(() => {
        if (thread) {
            dispatch(setThreadFollow(currentUserId, currentTeamId, threadIdentifier, !thread.is_following));
        }
    }, [dispatch, currentUserId, currentTeamId, threadIdentifier, thread]);

    const popout = useCallback(() => {
        if (currentTeam) {
            popoutThread(intl, threadIdentifier, currentTeam.name, (postId, returnTo) => {
                dispatch(focusPost(postId, returnTo, currentUserId, {skipRedirectReplyPermalink: true}));
            });
        }
    }, [threadIdentifier, currentTeam, intl, dispatch, currentUserId]);

    // Handlers for Pins and Members buttons (ThreadsInSidebar feature)
    const showPinnedPostsHandler = useCallback(() => {
        if (channelId) {
            if (rhsState === RHSStates.PIN) {
                dispatch(closeRightHandSide());
            } else {
                dispatch(showPinnedPosts(channelId));
            }
        }
    }, [dispatch, channelId, rhsState]);

    // Get thread name from root post message
    const threadName = rootPost ? cleanMessageForDisplay(rootPost.message) : '';

    // Loading state
    if (isLoading) {
        return (
            <div
                id='app-content'
                className='ThreadView app__content'
            >
                <div className='no-results__holder'>
                    <LoadingScreen/>
                </div>
            </div>
        );
    }

    // Thread not found
    if (!thread || !rootPost) {
        return (
            <div
                id='app-content'
                className='ThreadView app__content'
            >
                <NoResultsIndicator
                    expanded={true}
                    iconGraphic={ChatIllustration}
                    title={formatMessage({
                        id: 'threading.threadView.notFound.title',
                        defaultMessage: 'Thread not found',
                    })}
                    subtitle={formatMessage({
                        id: 'threading.threadView.notFound.subtitle',
                        defaultMessage: 'The thread you are looking for could not be found or may have been deleted.',
                    })}
                />
            </div>
        );
    }

    const isFollowing = thread.is_following ?? false;
    const hasUnreads = isFollowing && Boolean((thread as UserThread).unread_replies || (thread as UserThread).unread_mentions);
    const unreadTimestamp = rootPost.edit_at || rootPost.create_at;

    // Pinned button class (ThreadsInSidebar feature)
    const pinnedIconClass = classNames('channel-header__icon channel-header__icon--wide channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': rhsState === RHSStates.PIN,
    });

    // Render enhanced header when ThreadsInSidebar is enabled
    const renderHeading = () => {
        if (isThreadsInSidebarEnabled && threadName) {
            return (
                <>
                    <Button
                        className='Button___icon Button___large back'
                        onClick={goBack}
                    >
                        <i className='icon icon-arrow-back-ios'/>
                    </Button>
                    <div className='ThreadView__header-title'>
                        <h3 className='ThreadView__header-name'>
                            <span className='icon-discord-thread ThreadView__header-icon'/>
                            <span className='ThreadView__header-text'>{threadName}</span>
                        </h3>
                        <div className='ThreadView__header-icons'>
                            {participantIds.length > 0 && (
                                <Avatars
                                    userIds={participantIds}
                                    size='xs'
                                />
                            )}
                            {pinnedPostsCount > 0 && (
                                <HeaderIconWrapper
                                    buttonClass={pinnedIconClass}
                                    buttonId={'threadHeaderPinButton'}
                                    onClick={showPinnedPostsHandler}
                                    tooltip={formatMessage({id: 'channel_header.pinnedPosts', defaultMessage: 'Pinned messages'})}
                                >
                                    <i
                                        aria-hidden='true'
                                        className='icon icon-pin-outline channel-header__pin'
                                    />
                                    <span
                                        id='threadPinnedPostCountText'
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
                    onClick={goBack}
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
                        onClick={goToInChannel}
                    >
                        {channel?.display_name}
                    </Button>
                </h3>
            </>
        );
    };

    return (
        <div
            id='app-content'
            className={classNames('ThreadView app__content')}
        >
            <div className='ThreadView__pane'>
                <Header
                    className='ThreadView__header'
                    heading={renderHeading()}
                    right={(
                        <>
                            <FollowButton
                                isFollowing={isFollowing}
                                onClick={followHandler}
                            />
                            <PopoutButton onClick={popout}/>
                            <ThreadMenu
                                threadId={threadIdentifier}
                                isFollowing={isFollowing}
                                hasUnreads={hasUnreads}
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
                <ThreadViewer
                    rootPostId={threadIdentifier}
                    useRelativeTimestamp={true}
                    isThreadView={true}
                />
            </div>
        </div>
    );
};

export default memo(ThreadView);
