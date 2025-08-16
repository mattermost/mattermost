// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import type {UserThread} from '@mattermost/types/threads';

import {setThreadFollow, updateThreadRead, markLastPostInThreadAsUnread} from 'mattermost-redux/actions/threads';
import {isPostFlagged} from 'mattermost-redux/selectors/entities/posts';

import {
    flagPost as savePost,
    unflagPost as unsavePost,
} from 'actions/post_actions';
import {manuallyMarkThreadAsUnread} from 'actions/views/threads';

import * as Menu from 'components/menu';

import {useReadout} from 'hooks/useReadout';
import {getSiteURL} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {useThreadRouting} from '../../hooks';

type Props = {
    threadId: UserThread['id'];
    isFollowing?: boolean;
    hasUnreads: boolean;
    unreadTimestamp: number;
};

function ThreadMenu({
    threadId,
    isFollowing = false,
    unreadTimestamp,
    hasUnreads,
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
    const readAloud = useReadout();

    const handleReadUnread = useCallback(() => {
        readAloud(hasUnreads ? formatMessage({
            id: 'threading.threadMenu.markedRead',
            defaultMessage: 'Marked as read',
        }) : formatMessage({
            id: 'threading.threadMenu.markedUnread',
            defaultMessage: 'Marked as unread',
        }));
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
        <Menu.Container
            menuButton={{
                id: `thread-menu-${threadId}`,
                class: 'btn btn-icon btn-sm',
                'aria-label': formatMessage({
                    id: 'threading.threadHeader.menu',
                    defaultMessage: 'More Actions',
                }),
                children: (
                    <DotsVerticalIcon size={18}/>
                ),
            }}
            menuButtonTooltip={{
                text: formatMessage({
                    id: 'threading.threadHeader.menu',
                    defaultMessage: 'More Actions',
                }),
            }}
            menu={{
                id: `thread-menu-dropdown-${threadId}`,
            }}
        >
            <Menu.Item
                labels={isFollowing ? (
                    <>
                        <FormattedMessage
                            id='threading.threadMenu.unfollow'
                            defaultMessage='Unfollow thread'
                        />
                        <FormattedMessage
                            id='threading.threadMenu.unfollowExtra'
                            defaultMessage='You won’t be notified about replies'
                        />
                    </>
                ) : (
                    <>
                        <FormattedMessage
                            id='threading.threadMenu.follow'
                            defaultMessage='Follow thread'
                        />
                        <FormattedMessage
                            id='threading.threadMenu.followExtra'
                            defaultMessage='You will be notified about replies'
                        />
                    </>)
                }
                onClick={useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
                    e.stopPropagation();

                    dispatch(setThreadFollow(currentUserId, currentTeamId, threadId, !isFollowing));
                    readAloud(isFollowing ? formatMessage({
                        id: 'threading.threadMenu.unfollowed',
                        defaultMessage: 'Unfollowed thread',
                    }) : formatMessage({
                        id: 'threading.threadMenu.followed',
                        defaultMessage: 'Followed thread',
                    }));
                }, [currentUserId, currentTeamId, threadId, isFollowing, setThreadFollow, readAloud, formatMessage])}
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='threading.threadMenu.openInChannel'
                        defaultMessage='Open in channel'
                    />
                }
                onClick={useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
                    e.stopPropagation();

                    goToInChannel(threadId);
                    readAloud(formatMessage({
                        id: 'threading.threadMenu.openingChannel',
                        defaultMessage: 'Opening channel',
                    }));
                }, [threadId, readAloud, formatMessage])}
            />
            <Menu.Item
                labels={hasUnreads ? (
                    <FormattedMessage
                        id='threading.threadMenu.markRead'
                        defaultMessage='Mark as read'
                    />
                ) : (
                    <FormattedMessage
                        id='threading.threadMenu.markUnread'
                        defaultMessage='Mark as unread'
                    />
                )}
                onClick={handleReadUnread}
            />
            <Menu.Item
                labels={isSaved ? (
                    <FormattedMessage
                        id='threading.threadMenu.unsave'
                        defaultMessage='Unsave'
                    />
                ) : (
                    <FormattedMessage
                        id='threading.threadMenu.save'
                        defaultMessage='Save'
                    />
                )}
                onClick={useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
                    e.stopPropagation();

                    dispatch(isSaved ? unsavePost(threadId) : savePost(threadId));
                    readAloud(isSaved ? formatMessage({
                        id: 'threading.threadMenu.unsaved',
                        defaultMessage: 'Unsaved',
                    }) : formatMessage({
                        id: 'threading.threadMenu.saved',
                        defaultMessage: 'Saved',
                    }));
                }, [threadId, isSaved])}
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='threading.threadMenu.copy'
                        defaultMessage='Copy link'
                    />
                }
                onClick={useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
                    e.stopPropagation();

                    copyToClipboard(`${getSiteURL()}/${team}/pl/${threadId}`);
                    readAloud(formatMessage({
                        id: 'threading.threadMenu.linkCopied',
                        defaultMessage: 'Link copied',
                    }));
                }, [team, threadId])}
            />
        </Menu.Container>
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
