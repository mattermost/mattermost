// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {useRouteMatch, useHistory} from 'react-router-dom';

import {DotsVerticalIcon, PencilOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';

import {Client4} from 'mattermost-redux/client';
import {getThread as fetchThread, setThreadFollow, patchThread} from 'mattermost-redux/actions/threads';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeamId, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {clearLastUnreadChannel} from 'actions/global_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';
import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS, showThreadPinnedPosts, showThreadFollowers, closeRightHandSide} from 'actions/views/rhs';
import {setSelectedThreadId} from 'actions/views/threads';
import {focusPost} from 'components/permalink_view/actions';
import ChatIllustration from 'components/common/svg_images_components/chat_illustration';
import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import LoadingScreen from 'components/loading_screen';
import NoResultsIndicator from 'components/no_results_indicator';
import PopoutButton from 'components/popout_button';
import Header from 'components/widgets/header';
import WithTooltip from 'components/with_tooltip';

import {RHSStates} from 'utils/constants';
import {popoutThread} from 'utils/popouts/popout_windows';

import {getRhsState, getPinnedPostsThreadId, getThreadFollowersThreadId} from 'selectors/rhs';

import type {GlobalState} from 'types/store';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import Button from '../common/button';
import FollowButton from '../common/follow_button';
import ThreadMenu from '../global_threads/thread_menu';
import ThreadViewer from '../thread_viewer';
import {cleanMessageForDisplay} from '../utils';

import './thread_view.scss';

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

    // Feature flag checks
    const config = useSelector(getConfig);
    const isThreadsInSidebarEnabled = (config as Record<string, string>)?.FeatureFlagThreadsInSidebar === 'true';
    const isCustomThreadNamesEnabled = (config as Record<string, string>)?.FeatureFlagCustomThreadNames === 'true';

    const channelId = thread?.post?.channel_id || rootPost?.channel_id;

    // Custom thread name editing state
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');

    // Thread followers count (fetched from API)
    const [threadFollowersCount, setThreadFollowersCount] = useState(0);

    // Thread pinned posts count (fetched from API)
    const [threadPinnedPostsCount, setThreadPinnedPostsCount] = useState(0);

    // RHS state for active button styling
    const rhsState = useSelector(getRhsState);
    const pinnedPostsThreadId = useSelector(getPinnedPostsThreadId);
    const threadFollowersThreadId = useSelector(getThreadFollowersThreadId);

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

    // Load thread if not already loaded
    useEffect(() => {
        if (!thread && threadIdentifier && currentUserId && currentTeamId) {
            setIsLoading(true);
            // Fetch the specific thread by ID
            dispatch(fetchThread(currentUserId, currentTeamId, threadIdentifier)).finally(() => {
                setIsLoading(false);
            });
        } else if (thread) {
            setIsLoading(false);
        }
    }, [dispatch, thread, threadIdentifier, currentUserId, currentTeamId]);

    // Fetch thread followers and pinned posts count (ThreadsInSidebar feature)
    // Also refetch when rhsState changes (e.g., after adding/removing followers from RHS)
    useEffect(() => {
        if (isThreadsInSidebarEnabled && threadIdentifier) {
            // Fetch thread followers
            Client4.getThreadFollowers(threadIdentifier).then((followers) => {
                setThreadFollowersCount(followers.length);
            }).catch(() => {
                setThreadFollowersCount(0);
            });

            // Fetch thread pinned posts
            Client4.getThreadPinnedPosts(threadIdentifier).then((postList) => {
                setThreadPinnedPostsCount(postList.order?.length || 0);
            }).catch(() => {
                setThreadPinnedPostsCount(0);
            });
        }
    }, [isThreadsInSidebarEnabled, threadIdentifier, rhsState]);

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

    // Handlers for Pins button (ThreadsInSidebar feature)
    const showPinnedPostsHandler = useCallback(() => {
        if (channelId && threadIdentifier) {
            // Check if we're already showing pinned posts for this thread
            if (rhsState === RHSStates.PIN && pinnedPostsThreadId === threadIdentifier) {
                dispatch(closeRightHandSide());
            } else {
                dispatch(showThreadPinnedPosts(threadIdentifier, channelId));
            }
        }
    }, [dispatch, channelId, threadIdentifier, rhsState, pinnedPostsThreadId]);

    // Handlers for Followers button (ThreadsInSidebar feature)
    const showThreadFollowersHandler = useCallback(() => {
        if (channelId && threadIdentifier) {
            // Check if we're already showing followers for this thread
            if (rhsState === RHSStates.THREAD_FOLLOWERS && threadFollowersThreadId === threadIdentifier) {
                dispatch(closeRightHandSide());
            } else {
                dispatch(showThreadFollowers(threadIdentifier, channelId));
            }
        }
    }, [dispatch, channelId, threadIdentifier, rhsState, threadFollowersThreadId]);

    // Custom thread name handlers
    const startEditingName = useCallback(() => {
        if (isCustomThreadNamesEnabled) {
            const currentCustomName = thread?.props?.custom_name || '';
            setEditedName(currentCustomName);
            setIsEditingName(true);
        }
    }, [isCustomThreadNamesEnabled, thread?.props?.custom_name]);

    const cancelEditingName = useCallback(() => {
        setIsEditingName(false);
        setEditedName('');
    }, []);

    const saveThreadName = useCallback(async () => {
        if (!threadIdentifier) {
            return;
        }
        const trimmedName = editedName.trim();
        const newProps = trimmedName ? {custom_name: trimmedName} : {custom_name: undefined};
        await dispatch(patchThread(threadIdentifier, {props: newProps}));
        setIsEditingName(false);
        setEditedName('');
    }, [dispatch, threadIdentifier, editedName]);

    const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            saveThreadName();
        } else if (e.key === 'Escape') {
            cancelEditingName();
        }
    }, [saveThreadName, cancelEditingName]);

    // Get thread name - prefer custom name, fall back to cleaned root post message
    const customThreadName = thread?.props?.custom_name;
    const autoGeneratedName = rootPost ? cleanMessageForDisplay(rootPost.message, 30) : '';
    const threadName = customThreadName || autoGeneratedName;

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
        'channel-header__icon--active': rhsState === RHSStates.PIN && pinnedPostsThreadId === threadIdentifier,
    });

    // Members button class
    const membersIconClass = classNames('channel-header__icon channel-header__icon--wide channel-header__icon--left btn btn-icon btn-xs', {
        'channel-header__icon--active': rhsState === RHSStates.THREAD_FOLLOWERS && threadFollowersThreadId === threadIdentifier,
    });

    // Render enhanced header when ThreadsInSidebar is enabled
    const renderHeading = () => {
        if (isThreadsInSidebarEnabled) {
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
                            {isEditingName ? (
                                <input
                                    type='text'
                                    className='ThreadView__header-name-input'
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    onKeyDown={handleNameKeyDown}
                                    onBlur={saveThreadName}
                                    autoFocus={true}
                                    placeholder={autoGeneratedName || formatMessage({id: 'threading.header.heading', defaultMessage: 'Thread'})}
                                />
                            ) : (
                                <span
                                    className={classNames('ThreadView__header-text', {'ThreadView__header-text--editable': isCustomThreadNamesEnabled})}
                                    onClick={isCustomThreadNamesEnabled ? startEditingName : undefined}
                                    title={isCustomThreadNamesEnabled ? formatMessage({id: 'threading.header.clickToRename', defaultMessage: 'Click to rename thread'}) : undefined}
                                >
                                    {threadName || formatMessage({id: 'threading.header.heading', defaultMessage: 'Thread'})}
                                    {isCustomThreadNamesEnabled && (
                                        <PencilOutlineIcon
                                            size={14}
                                            className='ThreadView__header-edit-icon'
                                        />
                                    )}
                                </span>
                            )}
                        </h3>
                        <div className='ThreadView__header-icons channel-header__icons'>
                            <HeaderIconWrapper
                                buttonClass={membersIconClass}
                                buttonId={'threadHeaderMembersButton'}
                                onClick={showThreadFollowersHandler}
                                tooltip={formatMessage({id: 'threading.header.followers', defaultMessage: 'Thread followers'})}
                            >
                                <i
                                    aria-hidden='true'
                                    className='icon icon-account-outline channel-header__members'
                                />
                                {threadFollowersCount > 0 && (
                                    <span
                                        id='threadFollowersCountText'
                                        className='icon__text'
                                    >
                                        {threadFollowersCount}
                                    </span>
                                )}
                            </HeaderIconWrapper>
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
                                {threadPinnedPostsCount > 0 && (
                                    <span
                                        id='threadPinnedPostCountText'
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
