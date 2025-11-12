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

import {useReadout} from 'hooks/useReadout';
import {canPopout, popoutThread} from 'utils/popouts/popout_windows';
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

    const popout = useCallback(() => {
        popoutThread(intl, threadId, team);
    }, [threadId, team, intl]);

    return (
        <MenuWrapper
            stopPropagationOnToggle={true}
        >
            {children}
            <Menu
                ariaLabel={formatMessage({
                    id: 'threading.threadItem.menu',
                    defaultMessage: 'Actions',
                })}
                openLeft={true}
            >
                {!canPopout && (
                    <Menu.ItemAction
                        buttonClass='PopoutMenuItem'
                        text={formatMessage({
                            id: 'threading.threadMenu.openInNewWindow',
                            defaultMessage: 'Open in new window',
                        })}
                        onClick={popout}
                        icon={<i className='icon icon-dock-window'/>}
                    />
                )}
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
                        readAloud(isFollowing ? formatMessage({
                            id: 'threading.threadMenu.unfollowed',
                            defaultMessage: 'Unfollowed thread',
                        }) : formatMessage({
                            id: 'threading.threadMenu.followed',
                            defaultMessage: 'Followed thread',
                        }));
                    }, [currentUserId, currentTeamId, threadId, isFollowing, setThreadFollow, readAloud, formatMessage])}
                />
                <Menu.ItemAction
                    text={formatMessage({
                        id: 'threading.threadMenu.openInChannel',
                        defaultMessage: 'Open in channel',
                    })}
                    onClick={useCallback(() => {
                        goToInChannel(threadId);
                        readAloud(formatMessage({
                            id: 'threading.threadMenu.openingChannel',
                            defaultMessage: 'Opening channel',
                        }));
                    }, [threadId, readAloud, formatMessage])}
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
                        readAloud(isSaved ? formatMessage({
                            id: 'threading.threadMenu.unsaved',
                            defaultMessage: 'Unsaved',
                        }) : formatMessage({
                            id: 'threading.threadMenu.saved',
                            defaultMessage: 'Saved',
                        }));
                    }, [threadId, isSaved])}
                />
                <Menu.ItemAction
                    text={formatMessage({
                        id: 'threading.threadMenu.copy',
                        defaultMessage: 'Copy link',
                    })}
                    onClick={useCallback(() => {
                        copyToClipboard(`${getSiteURL()}/${team}/pl/${threadId}`);
                        readAloud(formatMessage({
                            id: 'threading.threadMenu.linkCopied',
                            defaultMessage: 'Link copied',
                        }));
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
