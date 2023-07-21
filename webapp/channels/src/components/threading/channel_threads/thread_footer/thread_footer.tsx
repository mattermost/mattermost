// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Post} from '@mattermost/types/posts';
import {threadIsSynthetic, UserThread} from '@mattermost/types/threads';
import React, {memo, useCallback, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {selectPost} from 'actions/views/rhs';
import {setThreadFollow, getThread as fetchThread} from 'mattermost-redux/actions/threads';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import Button from 'components/threading/common/button';
import FollowButton from 'components/threading/common/follow_button';
import {THREADING_TIME} from 'components/threading/common/options';
import Timestamp from 'components/timestamp';
import SimpleTooltip from 'components/widgets/simple_tooltip';
import Avatars from 'components/widgets/users/avatars';

import {GlobalState} from 'types/store';

import './thread_footer.scss';

type Props = {
    threadId: UserThread['id'];
    replyClick?: React.EventHandler<React.MouseEvent>;
};

function ThreadFooter({
    threadId,
    replyClick,
}: Props) {
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const post = useSelector((state: GlobalState) => getPost(state, threadId));
    const getThreadOrSynthetic = useMemo(makeGetThreadOrSynthetic, [post.id]);
    const thread = useSelector((state: GlobalState) => getThreadOrSynthetic(state, post));

    useEffect(() => {
        if (threadIsSynthetic(thread) && thread.is_following && thread.reply_count > 0) {
            dispatch(fetchThread(currentUserId, currentTeamId, threadId));
        }
    }, []);

    const {
        participants,
        reply_count: totalReplies = 0,
        last_reply_at: lastReplyAt,
        is_following: isFollowing = false,
        post: {
            channel_id: channelId,
        },
    } = thread;
    const participantIds = useMemo(() => (participants || []).map(({id}) => id).reverse(), [participants]);

    const handleReply = useCallback((e) => {
        if (replyClick) {
            replyClick(e);
            return;
        }

        trackEvent('crt', 'replied_using_footer');
        e.stopPropagation();
        dispatch(selectPost({id: threadId, channel_id: channelId} as Post));
    }, [replyClick, threadId, channelId]);

    const handleFollowing = useCallback((e) => {
        e.stopPropagation();
        dispatch(setThreadFollow(currentUserId, currentTeamId, threadId, !isFollowing));
    }, [isFollowing]);

    return (
        <div className='ThreadFooter'>
            {!isFollowing || threadIsSynthetic(thread) || !thread.unread_replies ? (
                <div className='indicator'/>
            ) : (
                <SimpleTooltip
                    id='threadFooterIndicator'
                    content={
                        <FormattedMessage
                            id='threading.numNewMessages'
                            defaultMessage='{newReplies, plural, =0 {no unread messages} =1 {one unread message} other {# unread messages}}'
                            values={{newReplies: thread.unread_replies}}
                        />
                    }
                >
                    <div
                        className='indicator'
                        tabIndex={0}
                    >
                        <div className='dot-unreads'/>
                    </div>
                </SimpleTooltip>
            )}

            {participantIds && participantIds.length > 0 ? (
                <Avatars
                    userIds={participantIds}
                    size='sm'
                />
            ) : null}

            {thread.reply_count > 0 && (
                <Button
                    onClick={handleReply}
                    className='ReplyButton separated'
                    prepend={
                        <span className='icon'>
                            <i className='icon-reply-outline'/>
                        </span>
                    }
                >
                    <FormattedMessage
                        id='threading.numReplies'
                        defaultMessage='{totalReplies, plural, =0 {Reply} =1 {# reply} other {# replies}}'
                        values={{totalReplies}}
                    />
                </Button>
            )}

            <FollowButton
                isFollowing={isFollowing}
                className='separated'
                onClick={handleFollowing}
            />

            {Boolean(lastReplyAt) && (
                <Timestamp
                    value={lastReplyAt}
                    {...THREADING_TIME}
                >
                    {({formatted}) => (
                        <span className='Timestamp separated alt-visible'>
                            <FormattedMessage
                                id='threading.footer.lastReplyAt'
                                defaultMessage='Last reply {formatted}'
                                values={{formatted}}
                            />
                        </span>
                    )}
                </Timestamp>
            )}
        </div>
    );
}

export default memo(ThreadFooter);
