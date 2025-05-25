// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {markLastPostInThreadAsUnread, updateThreadRead} from 'mattermost-redux/actions/threads';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {Posts} from 'mattermost-redux/constants';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {ensureString} from 'mattermost-redux/utils/post_utils';

import {manuallyMarkThreadAsUnread} from 'actions/views/threads';
import {getIsMobileView} from 'selectors/views/browser';

import Markdown from 'components/markdown';
import {makeGetMentionKeysForPost} from 'components/post_markdown';
import PriorityBadge from 'components/post_priority/post_priority_badge';
import Button from 'components/threading/common/button';
import Timestamp from 'components/timestamp';
import CRTListTutorialTip from 'components/tours/crt_tour/crt_list_tutorial_tip';
import Tag from 'components/widgets/tag/tag';
import Avatars from 'components/widgets/users/avatars';
import WithTooltip from 'components/with_tooltip';

import {CrtTutorialSteps, Preferences} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import Attachment from './attachments';

import {THREADING_TIME} from '../../common/options';
import {useThreadRouting} from '../../hooks';
import ThreadMenu from '../thread_menu';

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
    atMentions: true,
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
    const postAuthor = ensureString(post.props?.override_username) || displayName;
    const getMentionKeysForPost = useMemo(() => makeGetMentionKeysForPost(), []);
    const mentionsKeys = useSelector((state: GlobalState) => getMentionKeysForPost(state, post, channel));
    const ref = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (isSelected) {
            ref.current?.focus();
        }
    }, [isSelected, threadId]);

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

    const selectHandler = useCallback((e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
        // If the event is a keyboard event, check if the key is 'Enter' or ' '.
        if ('key' in e) {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }
        }
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
        // If the event is a keyboard event, check if the key is 'Enter' or ' '.
        if ('key' in e) {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }
        }
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
        <>
            <div
                style={style}
                className={classNames('ThreadItem', {
                    'has-unreads': newReplies,
                    'is-selected': isSelected,
                })}
                tabIndex={isSelected ? -1 : 0}
                role='link'
                aria-label={formatMessage(
                    {id: 'threading.threadItem.ariaLabel', defaultMessage: 'Thread by {author}'},
                    {author: postAuthor},
                )}
                aria-describedby={`ThreadItem__timestamp_${threadId}`}
                id={isFirstThreadInList ? 'tutorial-threads-mobile-list' : ''}
                onClick={selectHandler}
                onKeyDown={selectHandler}
                ref={ref}
            >
                <header>
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
                </header>
                <div className='menu-anchor alt-visible'>
                    <ThreadMenu
                        threadId={threadId}
                        isFollowing={isFollowing ?? false}
                        hasUnreads={Boolean(newReplies)}
                        unreadTimestamp={unreadTimestamp}
                    >
                        <WithTooltip
                            title={(
                                <FormattedMessage
                                    id='threading.threadItem.menu'
                                    defaultMessage='Actions'
                                />
                            )}
                        >
                            <Button
                                marginTop={true}
                                className='Button___icon'
                                aria-label={formatMessage({
                                    id: 'threading.threadItem.menu',
                                    defaultMessage: 'Actions',
                                })}
                            >
                                <DotsVerticalIcon size={18}/>
                            </Button>
                        </WithTooltip>
                    </ThreadMenu>
                </div>

                {/* The strange interaction here where we need a click/keydown handler messes with the ESLint rules, so we just disable it */}
                {/*eslint-disable-next-line jsx-a11y/no-static-element-interactions*/}
                <div
                    className='preview'
                    dir='auto'
                    onClick={handleFormattedTextClick}
                    onKeyDown={handleFormattedTextClick}
                >
                    {post.message ? (
                        <Markdown
                            message={post.state === Posts.POST_DELETED ? msgDeleted : post.message}
                            options={markdownPreviewOptions}
                            imagesMetadata={post?.metadata && post?.metadata?.images}
                            mentionKeys={mentionsKeys}
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
                <span
                    className='sr-only'
                    id={`ThreadItem__timestamp_${threadId}`}
                >
                    <FormattedMessage
                        id='threading.threadItem.timestamp'
                        defaultMessage='Last reply '
                    />
                    <Timestamp
                        {...THREADING_TIME}
                        className='alt-hidden'
                        value={lastReplyAt}
                    />
                </span>
            </div>
        </>
    );
}

export default memo(ThreadItem);
