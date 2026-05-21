// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {isMyChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {clearPlatformNotificationRecord} from 'actions/views/rhs';
import Post from 'components/post';
import ThreadFooter from 'components/threading/channel_threads/thread_footer';

import {getHistory} from 'utils/browser_history';
import {Locations} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

import './rhs_notification_card.scss';

type Props = {
    record: PlatformNotificationRecord;
    a11yIndex: number;
};

export default function RhsNotificationCard({record, a11yIndex}: Props) {
    const dispatch = useDispatch();
    const intl = useIntl();
    const post = useSelector((state: GlobalState) => getPost(state, record.postId));
    const collapsedThreads = useSelector(isCollapsedThreadsEnabled);
    const autotranslated = useSelector((state: GlobalState) =>
        (post ? isMyChannelAutotranslated(state, post.channel_id) : false),
    );

    const handleOpen = useCallback(() => {
        getHistory().push(record.permalinkUrl);
    }, [record.permalinkUrl]);

    const showThreadFooter = Boolean(collapsedThreads && record.isThreadReply && post?.root_id);

    return (
        <div className='RhsNotificationCard'>
            <div className='RhsNotificationCard__channelRowWrap'>
                <button
                    type='button'
                    className='RhsNotificationCard__channelRow'
                    onClick={handleOpen}
                >
                    <span className='RhsNotificationCard__atIcon'>
                        <i
                            className='icon icon-at'
                            aria-hidden='true'
                        />
                    </span>
                    <span className='RhsNotificationCard__channelMeta'>
                        <span className='RhsNotificationCard__contextLabel'>
                            {record.contextLabel}
                        </span>
                        <span
                            className='RhsNotificationCard__divider'
                            aria-hidden='true'
                        />
                        <span className='RhsNotificationCard__channelName'>
                            {record.channelDisplayName || (
                                <FormattedMessage
                                    id='rhs_notification_activity.unknown_channel'
                                    defaultMessage='Channel'
                                />
                            )}
                        </span>
                    </span>
                </button>
                <WithTooltip
                    title={intl.formatMessage({
                        id: 'rhs_notification_activity.dismiss.tooltip',
                        defaultMessage: 'Remove this notification',
                    })}
                >
                    <button
                        type='button'
                        className='RhsNotificationCard__dismiss btn btn-icon btn-sm'
                        aria-label={intl.formatMessage({
                            id: 'rhs_notification_activity.dismiss',
                            defaultMessage: 'Remove notification',
                        })}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dispatch(clearPlatformNotificationRecord(record.id));
                        }}
                    >
                        <i
                            className='icon icon-close'
                            aria-hidden='true'
                        />
                    </button>
                </WithTooltip>
            </div>

            <div className='RhsNotificationCard__body'>
                {post ? (
                    <Post
                        post={post}
                        matches={[]}
                        term=''
                        isMentionSearch={true}
                        hideSearchChannelHeader={true}
                        a11yIndex={a11yIndex}
                        location={Locations.SEARCH}
                        isChannelAutotranslated={autotranslated}
                    />
                ) : (
                    <div className='RhsNotificationCard__fallback'>
                        {record.previewBody}
                    </div>
                )}
            </div>

            {showThreadFooter && post?.root_id ? (
                <div className='RhsNotificationCard__threadFooter'>
                    <ThreadFooter
                        threadId={post.root_id}
                        replyClick={handleOpen}
                    />
                </div>
            ) : null}
        </div>
    );
}
