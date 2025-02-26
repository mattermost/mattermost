// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import type {ReactNode} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {UserThread} from '@mattermost/types/threads';

import {setThreadFollow, updateThreadRead, markLastPostInThreadAsUnread} from 'mattermost-redux/actions/threads';
import {isPostFlagged} from 'mattermost-redux/selectors/entities/posts';

import {
    flagPost as savePost,
    unflagPost as unsavePost,
} from 'actions/post_actions';
import {manuallyMarkThreadAsUnread} from 'actions/views/threads';

import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {getSiteURL} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {useThreadRouting} from '../../hooks';

import './thread_menu.scss';

type Props = {
    threadId: UserThread['id'];
    isFollowing?: boolean;
    hasUnreads: boolean;
    children: ReactNode;
    unreadTimestamp: number;
};

function ThreadMenu({
    threadId,
    isFollowing = false,
    unreadTimestamp,
    hasUnreads,
    children,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {
        params: {
            team,
        },
        currentTeamId,
        currentUserId,
        goToInChannel,
    } = useThreadRouting();

    const isSaved = useSelector((state: GlobalState) => isPostFlagged(state, threadId));

    const handleReadUnread = useCallback(() => {
        const lastViewedAt = hasUnreads ? Date.now() : unreadTimestamp;

        dispatch(manuallyMarkThreadAsUnread(threadId, lastViewedAt));
        if (hasUnreads) {
            dispatch(updateThreadRead(currentUserId, currentTeamId, threadId, Date.now()));
        } else {
            dispatch(markLastPostInThreadAsUnread(currentUserId, currentTeamId, threadId));
        }
    }, [
        currentUserId,
        currentTeamId,
        threadId,
        hasUnreads,
        updateThreadRead,
        unreadTimestamp,
    ]);

    return (
        <MenuWrapper
            stopPropagationOnToggle={true}
        >
            {children}
            <Menu
                ariaLabel={''}
                openLeft={true}
            >
                <Menu.ItemAction
                    {...isFollowing ? {
                        text: formatMessage({
                            id: 'threading.threadMenu.unfollow',
                            defaultMessage: 'Unfollow thread',
                        }),
                        extraText: formatMessage({
                            id: 'threading.threadMenu.unfollowExtra',
                            defaultMessage: 'You won’t be notified about replies',
                        }),
                    } : {
                        text: formatMessage({
                            id: 'threading.threadMenu.follow',
                            defaultMessage: 'Follow thread',
                        }),
                        extraText: formatMessage({
                            id: 'threading.threadMenu.followExtra',
                            defaultMessage: 'You will be notified about replies',
                        }),
                    }}
                    onClick={useCallback(() => {
                        dispatch(setThreadFollow(currentUserId, currentTeamId, threadId, !isFollowing));
                    }, [currentUserId, currentTeamId, threadId, isFollowing, setThreadFollow])}
                />
                <Menu.ItemAction
                    text={formatMessage({
                        id: 'threading.threadMenu.openInChannel',
                        defaultMessage: 'Open in channel',
                    })}
                    onClick={useCallback(() => {
                        goToInChannel(threadId);
                    }, [threadId])}
                />
                <Menu.ItemAction
                    text={hasUnreads ? formatMessage({
                        id: 'threading.threadMenu.markRead',
                        defaultMessage: 'Mark as read',
                    }) : formatMessage({
                        id: 'threading.threadMenu.markUnread',
                        defaultMessage: 'Mark as unread',
                    })}
                    onClick={handleReadUnread}
                />

                <Menu.ItemAction
                    text={isSaved ? formatMessage({
                        id: 'threading.threadMenu.unsave',
                        defaultMessage: 'Unsave',
                    }) : formatMessage({
                        id: 'threading.threadMenu.save',
                        defaultMessage: 'Save',
                    })}
                    onClick={useCallback(() => {
                        dispatch(isSaved ? unsavePost(threadId) : savePost(threadId));
                    }, [threadId, isSaved])}
                />
                <Menu.ItemAction
                    text={formatMessage({
                        id: 'threading.threadMenu.copy',
                        defaultMessage: 'Copy link',
                    })}
                    onClick={useCallback(() => {
                        copyToClipboard(`${getSiteURL()}/${team}/pl/${threadId}`);
                    }, [team, threadId])}
                />
            </Menu>
        </MenuWrapper>
    );
}

function areEqual(prevProps: Props, nextProps: Props) {
    return (
        prevProps.threadId === nextProps.threadId &&
        prevProps.isFollowing === nextProps.isFollowing &&
        prevProps.unreadTimestamp === nextProps.unreadTimestamp &&
        prevProps.hasUnreads === nextProps.hasUnreads
    );
}

export default memo(ThreadMenu, areEqual);
