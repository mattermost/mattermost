// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, MouseEvent, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import classNames from 'classnames';
import {useDispatch, useSelector} from 'react-redux';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';

import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {markLastPostInThreadAsUnread, updateThreadRead} from 'mattermost-redux/actions/threads';
import {Posts} from 'mattermost-redux/constants';

import * as Utils from 'utils/utils';
import {CrtTutorialSteps, Preferences} from 'utils/constants';
import {GlobalState} from 'types/store';
import {getIsMobileView} from 'selectors/views/browser';
import {manuallyMarkThreadAsUnread} from 'actions/views/threads';
import Timestamp from 'components/timestamp';
import Avatars from 'components/widgets/users/avatars';
import Button from 'components/threading/common/button';
import SimpleTooltip from 'components/widgets/simple_tooltip';
import CRTListTutorialTip from 'components/tours/crt_tour/crt_list_tutorial_tip';
import Markdown from 'components/markdown';
import Tag from 'components/widgets/tag/tag';
import PriorityBadge from 'components/post_priority/post_priority_badge';

import {Channel} from '@mattermost/types/channels';
import {Post, PostPriority} from '@mattermost/types/posts';
import {UserThread} from '@mattermost/types/threads';

import {THREADING_TIME} from '../../common/options';
import {useThreadRouting} from '../../hooks';
import ThreadMenu from '../thread_menu';

import Attachment from './attachments';
import './thread_item.scss';

export type OwnProps = {
    isSelected: boolean;
    threadId: UserThread['id'];
    style?: any;
    isFirstThreadInList: boolean;
};

type Props = {
    channel: Channel;
    currentRelativeTeamUrl: string;
    displayName: string;
    post: Post;
    postsInThread: Post[];
    thread: UserThread;
    isPostPriorityEnabled: boolean;
};

const markdownPreviewOptions = {
    singleline: true,
    mentionHighlight: false,
    atMentions: false,
};

function ThreadItem({
    channel,
    currentRelativeTeamUrl,
    displayName,
    isSelected,
    post,
    postsInThread,
    style,
    thread,
    threadId,
    isFirstThreadInList,
    isPostPriorityEnabled,
}: Props & OwnProps): React.ReactElement|null {
    const dispatch = useDispatch();
    const {select, goToInChannel, currentTeamId} = useThreadRouting();
    const {formatMessage} = useIntl();
    const isMobileView = useSelector(getIsMobileView);
    const currentUserId = useSelector(getCurrentUserId);
    const tipStep = useSelector((state: GlobalState) => getInt(state, Preferences.CRT_TUTORIAL_STEP, currentUserId));
    const showListTutorialTip = tipStep === CrtTutorialSteps.LIST_POPOVER;
    const msgDeleted = formatMessage({id: 'post_body.deleted', defaultMessage: '(message deleted)'});
    const postAuthor = post.props?.override_username || displayName;

    useEffect(() => {
        if (channel?.teammate_id) {
            dispatch(getMissingProfilesByIds([channel.teammate_id]));
        }
    }, [channel?.teammate_id]);

    useEffect(() => {
        if (!channel && thread?.post.channel_id) {
            dispatch(fetchChannel(thread.post.channel_id));
        }
    }, [channel, thread?.post.channel_id]);

    const participantIds = useMemo(() => {
        const ids = (thread?.participants || []).flatMap(({id}) => {
            if (id === post.user_id) {
                return [];
            }
            return id;
        }).reverse();
        return [post.user_id, ...ids];
    }, [thread?.participants]);

    let unreadTimestamp = post.edit_at || post.create_at;

    const selectHandler = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (e.altKey) {
            const hasUnreads = thread ? Boolean(thread.unread_replies) : false;
            const lastViewedAt = hasUnreads ? Date.now() : unreadTimestamp;

            dispatch(manuallyMarkThreadAsUnread(threadId, lastViewedAt));
            if (hasUnreads) {
                dispatch(updateThreadRead(currentUserId, currentTeamId, threadId, Date.now()));
            } else {
                dispatch(markLastPostInThreadAsUnread(currentUserId, currentTeamId, threadId));
            }
        } else {
            select(threadId);
        }
    }, [
        currentUserId,
        currentTeamId,
        threadId,
        thread,
        updateThreadRead,
        unreadTimestamp,
    ]);

    const imageProps = useMemo(() => ({
        onImageHeightChanged: () => {},
        onImageLoaded: () => {},
    }), []);

    const goToInChannelHandler = useCallback((e: MouseEvent) => {
        e.stopPropagation();
        goToInChannel(threadId);
    }, [threadId]);

    const handleFormattedTextClick = useCallback((e) => {
        Utils.handleFormattedTextClick(e, currentRelativeTeamUrl);
    }, [currentRelativeTeamUrl]);

    if (!thread || !post) {
        return null;
    }

    const {
        unread_replies: newReplies,
        unread_mentions: newMentions,
        last_reply_at: lastReplyAt,
        reply_count: totalReplies,
        is_following: isFollowing,
    } = thread;

    // if we have the whole thread, get the posts in it, sorted from newest to oldest.
    // First post is latest reply. Use that timestamp
    if (postsInThread.length > 1) {
        const p = postsInThread[0];
        unreadTimestamp = p.edit_at || p.create_at;
    }

    return (
        <article
            style={style}
            className={classNames('ThreadItem', {
                'has-unreads': newReplies,
                'is-selected': isSelected,
            })}
            tabIndex={0}
            id={isFirstThreadInList ? 'tutorial-threads-mobile-list' : ''}
            onClick={selectHandler}
        >
            <h1>
                {Boolean(newMentions || newReplies) && (
                    <div className='indicator'>
                        {newMentions ? (
                            <div className={classNames('dot-mentions', {over: newMentions > 99})}>
                                {Math.min(newMentions, 99)}
                                {newMentions > 99 && '+'}
                            </div>
                        ) : (
                            <div className='dot-unreads'/>
                        )}
                    </div>
                )}
                <div className='ThreadItem__author'>{postAuthor}</div>
                <div className='ThreadItem__tags'>
                    {channel && postAuthor !== channel?.display_name && (
                        <Tag
                            onClick={goToInChannelHandler}
                            text={channel?.display_name}
                        />
                    )}
                    {isPostPriorityEnabled && (
                        thread.is_urgent && (
                            <PriorityBadge
                                className={postAuthor === channel?.display_name ? 'ml-2' : ''}
                                priority={PostPriority.URGENT}
                            />
                        )
                    )}
                </div>
                <Timestamp
                    {...THREADING_TIME}
                    className='alt-hidden'
                    value={lastReplyAt}
                />
            </h1>
            <div className='menu-anchor alt-visible'>
                <ThreadMenu
                    threadId={threadId}
                    isFollowing={isFollowing ?? false}
                    hasUnreads={Boolean(newReplies)}
                    unreadTimestamp={unreadTimestamp}
                >
                    <SimpleTooltip
                        id='threadActionMenu'
                        content={(
                            <FormattedMessage
                                id='threading.threadItem.menu'
                                defaultMessage='Actions'
                            />
                        )}
                    >
                        <Button
                            marginTop={true}
                            className='Button___icon'
                        >
                            <DotsVerticalIcon size={18}/>
                        </Button>
                    </SimpleTooltip>
                </ThreadMenu>
            </div>
            <div
                aria-readonly='true'
                className='preview'
                dir='auto'
                tabIndex={0}
                onClick={handleFormattedTextClick}
            >
                {post.message ? (
                    <Markdown
                        message={post.state === Posts.POST_DELETED ? msgDeleted : post.message}
                        options={markdownPreviewOptions}
                        imagesMetadata={post?.metadata && post?.metadata?.images}
                        imageProps={imageProps}
                    />
                ) : (
                    <Attachment post={post}/>
                )}
            </div>
            <div className='activity'>
                {participantIds?.length ? (
                    <Avatars
                        userIds={participantIds}
                        size='xs'
                    />
                ) : null}
                {Boolean(totalReplies) && (
                    <>
                        {newReplies ? (
                            <FormattedMessage
                                id='threading.numNewReplies'
                                defaultMessage='{newReplies, plural, =1 {# new reply} other {# new replies}}'
                                values={{newReplies}}
                            />
                        ) : (
                            <FormattedMessage
                                id='threading.numReplies'
                                defaultMessage='{totalReplies, plural, =0 {Reply} =1 {# reply} other {# replies}}'
                                values={{totalReplies}}
                            />
                        )}
                    </>
                )}
            </div>
            {showListTutorialTip && isFirstThreadInList && isMobileView && (<CRTListTutorialTip/>)}
        </article>
    );
}

export default memo(ThreadItem);
