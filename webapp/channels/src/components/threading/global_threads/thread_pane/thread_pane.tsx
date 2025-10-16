// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import type {ReactNode} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import type {UserThread, UserThreadSynthetic} from '@mattermost/types/threads';

import {setThreadFollow} from 'mattermost-redux/actions/threads';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost, makeGetPostsForThread} from 'mattermost-redux/selectors/entities/posts';

import PopoutButton from 'components/popout_button';
import Header from 'components/widgets/header';
import WithTooltip from 'components/with_tooltip';

import {popoutThread} from 'utils/popouts/popout_windows';

import type {GlobalState} from 'types/store';

import Button from '../../common/button';
import FollowButton from '../../common/follow_button';
import {useThreadRouting} from '../../hooks';
import ThreadMenu from '../thread_menu';

import './thread_pane.scss';

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
    const selectHandler = useCallback(() => select(), []);
    let unreadTimestamp = post.edit_at || post.create_at;

    // if we have the whole thread, get the posts in it, sorted from newest to oldest.
    // First post is latest reply. Use that timestamp
    if (postsInThread.length > 1) {
        const p = postsInThread[0];
        unreadTimestamp = p.edit_at || p.create_at;
    }
    const goToInChannelHandler = useCallback(() => {
        goToInChannel(threadId);
    }, [goToInChannel, threadId]);

    const followHandler = useCallback(() => {
        dispatch(setThreadFollow(currentUserId, currentTeamId, threadId, !isFollowing));
    }, [dispatch, currentUserId, currentTeamId, threadId, isFollowing]);

    const popout = useCallback(() => {
        popoutThread(intl, threadId, team);
    }, [threadId, team, intl]);

    return (
        <div
            id={'thread-pane-container'}
            className='ThreadPane'
        >
            <Header
                className='ThreadPane___header'
                heading={(
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
                )}
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
