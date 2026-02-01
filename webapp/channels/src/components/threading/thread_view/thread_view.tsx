// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {useRouteMatch, useHistory} from 'react-router-dom';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import type {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';

import {getThreadsForCurrentTeam, setThreadFollow} from 'mattermost-redux/actions/threads';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeamId, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThread} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {clearLastUnreadChannel} from 'actions/global_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';
import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import {setSelectedThreadId} from 'actions/views/threads';
import {focusPost} from 'components/permalink_view/actions';
import ChatIllustration from 'components/common/svg_images_components/chat_illustration';
import LoadingScreen from 'components/loading_screen';
import NoResultsIndicator from 'components/no_results_indicator';
import PopoutButton from 'components/popout_button';
import Header from 'components/widgets/header';
import WithTooltip from 'components/with_tooltip';

import {popoutThread} from 'utils/popouts/popout_windows';

import type {GlobalState} from 'types/store';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import Button from '../common/button';
import FollowButton from '../common/follow_button';
import ThreadMenu from '../global_threads/thread_menu';
import ThreadViewer from '../thread_viewer';

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

    return (
        <div
            id='app-content'
            className={classNames('ThreadView app__content')}
        >
            <div className='ThreadView__pane'>
                <Header
                    className='ThreadView__header'
                    heading={(
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
                    )}
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
