// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import type {IntlShape, KeyboardEvent, MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import classNames from 'classnames';

import {Posts} from 'mattermost-redux/constants';
import {getChannel, isMyChannelAutotranslated} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getTeammateNameDisplaySetting, get} from 'mattermost-redux/selectors/entities/preferences';
import {getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {isDirectChannel} from 'mattermost-redux/utils/channel_utils';
import {ensureString} from 'mattermost-redux/utils/post_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {openPlatformNotificationRecord} from 'actions/views/rhs';
import Markdown from 'components/markdown';
import {makeGetMentionKeysForPost} from 'components/post_markdown';
import ProfilePicture from 'components/profile_picture';
import Avatar from 'components/widgets/users/avatar';

import RhsNotificationMenu from './rhs_notification_menu';

import * as Utils from 'utils/utils';
import {Preferences} from 'utils/constants';
import {getPostTranslatedMessage, getPostTranslation} from 'utils/post_utils';
import {isPlatformNotificationUnread} from 'utils/platform_notification_unread';

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

import './rhs_notification_card.scss';

type Props = {
    record: PlatformNotificationRecord;
};

const markdownPreviewOptions = {
    singleline: true,
    mentionHighlight: false,
    atMentions: true,
};

function recordIsMention(record: PlatformNotificationRecord): boolean {
    if (typeof record.isMention === 'boolean') {
        return record.isMention;
    }

    return record.contextLabel.toLowerCase().includes('mention');
}

function getFallbackSenderName(previewBody: string): string {
    const previewPrefix = previewBody.split(':')[0]?.trim() || '';
    return previewPrefix.replace(/^@+/, '');
}

function getParticipantIds(record: PlatformNotificationRecord, senderUserId: string): string[] {
    if (record.participantUserIds?.length) {
        return record.participantUserIds;
    }

    if (senderUserId) {
        return [senderUserId];
    }

    return [];
}

function getPreviewBody(record: PlatformNotificationRecord): string {
    if (record.previewBody.includes(':')) {
        return record.previewBody.split(':').slice(1).join(':').trim();
    }

    return record.previewBody;
}

function getThreadOthersLabel(otherCount: number, intl: IntlShape): string {
    switch (otherCount) {
    case 1:
        return intl.formatMessage({
            id: 'rhs_notification_activity.others.one',
            defaultMessage: 'one other',
        });
    case 2:
        return intl.formatMessage({
            id: 'rhs_notification_activity.others.two',
            defaultMessage: 'two others',
        });
    case 3:
        return intl.formatMessage({
            id: 'rhs_notification_activity.others.three',
            defaultMessage: 'three others',
        });
    case 4:
        return intl.formatMessage({
            id: 'rhs_notification_activity.others.four',
            defaultMessage: 'four others',
        });
    default:
        return intl.formatMessage({
            id: 'rhs_notification_activity.others.many',
            defaultMessage: '{count} others',
        }, {count: otherCount});
    }
}

function formatShortRelativeTime(timestamp: number, intl: IntlShape): string {
    const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

    if (diffSeconds < 60) {
        return intl.formatMessage({
            id: 'rhs_notification_activity.time.now',
            defaultMessage: 'now',
        });
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
        return intl.formatMessage({
            id: 'rhs_notification_activity.time.minutes',
            defaultMessage: '{count}m ago',
        }, {count: diffMinutes});
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return intl.formatMessage({
            id: 'rhs_notification_activity.time.hours',
            defaultMessage: '{count}h ago',
        }, {count: diffHours});
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
        return intl.formatMessage({
            id: 'rhs_notification_activity.time.days',
            defaultMessage: '{count}d ago',
        }, {count: diffDays});
    }

    return intl.formatDate(timestamp, {month: 'short', day: 'numeric'});
}

export default function RhsNotificationCard({record}: Props) {
    const dispatch = useDispatch();
    const intl = useIntl();
    const {locale} = intl;
    const post = useSelector((state: GlobalState) => getPost(state, record.postId));
    const senderUserId = record.senderUserId || post?.user_id || '';
    const sender = useSelector((state: GlobalState) => getUser(state, senderUserId));
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);
    const channel = useSelector((state: GlobalState) => getChannel(state, record.channelId));
    const isDirectMessage = record.isDirectMessage || (channel ? isDirectChannel(channel) : false);
    const participantIds = getParticipantIds(record, senderUserId);
    const getMentionKeysForPost = useMemo(() => makeGetMentionKeysForPost(), []);
    const isMention = recordIsMention(record);
    const previewPost = post;
    const previewAutotranslated = useSelector((state: GlobalState) =>
        (previewPost ? isMyChannelAutotranslated(state, previewPost.channel_id) : false),
    );
    const previewMentionKeys = useSelector((state: GlobalState) =>
        (previewPost && channel ? getMentionKeysForPost(state, previewPost, channel) : []),
    );
    const hasUnreads = useSelector((state: GlobalState) => isPlatformNotificationUnread(state, record));

    const senderName = useMemo(() => {
        if (sender) {
            return displayUsername(sender, teammateNameDisplay);
        }

        const fallbackName = getFallbackSenderName(record.previewBody);
        if (fallbackName) {
            return fallbackName;
        }

        return intl.formatMessage({
            id: 'channel_loader.someone',
            defaultMessage: 'Someone',
        });
    }, [sender, teammateNameDisplay, record.previewBody, intl]);

    const otherParticipantCount = useMemo(() => {
        return participantIds.filter((userId) => userId && userId !== senderUserId).length;
    }, [participantIds, senderUserId]);

    const channelName = record.channelDisplayName || intl.formatMessage({
        id: 'rhs_notification_activity.unknown_channel',
        defaultMessage: 'Channel',
    });

    const headerUserId = senderUserId;
    const shortTimestamp = useMemo(
        () => formatShortRelativeTime(record.recordedAt, intl),
        [record.recordedAt, intl],
    );

    const headerMessage = useMemo(() => {
        if (isDirectMessage) {
            const messageCount = record.replyCount || 1;
            if (messageCount > 1) {
                return (
                    <FormattedMessage
                        id='rhs_notification_activity.header.direct_messages'
                        defaultMessage='{sender} sent you {count} direct messages.'
                        values={{
                            sender: <span className='RhsNotificationCard__senderName'>{senderName}</span>,
                            count: messageCount,
                        }}
                    />
                );
            }

            return (
                <FormattedMessage
                    id='rhs_notification_activity.header.direct_message'
                    defaultMessage='{sender} sent you a direct message.'
                    values={{
                        sender: <span className='RhsNotificationCard__senderName'>{senderName}</span>,
                    }}
                />
            );
        }

        if (isMention && !record.isThreadReply) {
            return (
                <FormattedMessage
                    id='rhs_notification_activity.header.mention'
                    defaultMessage='{sender} mentioned you in {channel}'
                    values={{
                        sender: <span className='RhsNotificationCard__senderName'>{senderName}</span>,
                        channel: <span className='RhsNotificationCard__channelName'>{channelName}</span>,
                    }}
                />
            );
        }

        if (record.isThreadReply) {
            if (otherParticipantCount > 0) {
                return (
                    <FormattedMessage
                        id='rhs_notification_activity.header.thread_reply.with_others'
                        defaultMessage="{sender} and {others} replied in a thread that you're following."
                        values={{
                            sender: <span className='RhsNotificationCard__senderName'>{senderName}</span>,
                            others: getThreadOthersLabel(otherParticipantCount, intl),
                        }}
                    />
                );
            }

            return (
                <FormattedMessage
                    id='rhs_notification_activity.header.thread_reply'
                    defaultMessage="{sender} replied in a thread that you're following."
                    values={{
                        sender: <span className='RhsNotificationCard__senderName'>{senderName}</span>,
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='rhs_notification_activity.header.message'
                defaultMessage='{sender} sent a message in {channel}'
                values={{
                    sender: <span className='RhsNotificationCard__senderName'>{senderName}</span>,
                    channel: <span className='RhsNotificationCard__channelName'>{channelName}</span>,
                }}
            />
        );
    }, [isDirectMessage, isMention, record.isThreadReply, record.replyCount, senderName, channelName, otherParticipantCount, intl]);

    const headerUser = useSelector((state: GlobalState) => getUser(state, headerUserId));
    const headerUserStatus = useSelector((state: GlobalState) => getStatusForUserId(state, headerUserId));
    const availabilityStatusOnPosts = useSelector((state: GlobalState) =>
        get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.AVAILABILITY_STATUS_ON_POSTS, Preferences.AVAILABILITY_STATUS_ON_POSTS_DEFAULT),
    );
    const headerUserName = headerUser ? displayUsername(headerUser, teammateNameDisplay) : senderName;
    const profileSrc = headerUserId ? Utils.imageURLForUser(headerUserId, headerUser?.last_picture_update) : '';
    const profileStatus = availabilityStatusOnPosts === 'true' && headerUserId && !headerUser?.is_bot ? headerUserStatus : '';

    const avatar = headerUserId ? (
        <ProfilePicture
            size='md'
            src={profileSrc}
            profileSrc={profileSrc}
            userId={headerUserId}
            channelId={record.channelId}
            username={headerUser?.username}
            isBot={headerUser?.is_bot}
            status={profileStatus}
            wrapperClass='RhsNotificationCard__avatar'
        />
    ) : (
        <Avatar
            size='md'
            text={headerUserName.charAt(0).toUpperCase()}
            url=''
        />
    );

    const openNotification = useCallback(() => {
        dispatch(openPlatformNotificationRecord(record));
    }, [dispatch, record]);

    const handleCardClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (e.defaultPrevented) {
            return;
        }

        openNotification();
    }, [openNotification]);

    const handleCardKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openNotification();
        }
    }, [openNotification]);

    const previewMessage = useMemo(() => {
        if (!previewPost) {
            return getPreviewBody(record);
        }

        const translation = getPostTranslation(previewPost, locale);
        let message = previewPost.message;
        if (previewAutotranslated && previewPost.type === '' && translation?.state === 'ready') {
            message = getPostTranslatedMessage(message, translation);
        }

        return message;
    }, [previewPost, locale, previewAutotranslated, record]);

    const msgDeleted = intl.formatMessage({id: 'post_body.deleted', defaultMessage: '(message deleted)'});
    const markdownOptions = useMemo(() => ({
        ...markdownPreviewOptions,
        mentionHighlight: isMention,
    }), [isMention]);

    return (
        <div
            className={classNames('RhsNotificationCard', {'has-unreads': hasUnreads})}
            role='link'
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={handleCardKeyDown}
        >
            <div className='RhsNotificationCard__layout'>
                <div className='RhsNotificationCard__avatarSlot'>
                    {avatar}
                </div>
                <div className='RhsNotificationCard__content'>
                    <div className='RhsNotificationCard__headerWrap'>
                        <div className='RhsNotificationCard__header'>
                            <span className='RhsNotificationCard__summary'>
                                {headerMessage}
                            </span>
                        </div>
                        <div className='RhsNotificationCard__headerActions'>
                            {hasUnreads && (
                                <div className='RhsNotificationCard__unreadIndicator alt-hidden'>
                                    <div className='dot-unreads'/>
                                </div>
                            )}
                            <time
                                className='RhsNotificationCard__timestamp alt-hidden'
                                dateTime={new Date(record.recordedAt).toISOString()}
                            >
                                {shortTimestamp}
                            </time>
                            <div
                                className='menu-anchor alt-visible'
                                onClick={(e) => e.stopPropagation()}
                            >
                                <RhsNotificationMenu record={record}/>
                            </div>
                        </div>
                    </div>

                    <div className='RhsNotificationCard__body'>
                        <div
                            className='RhsNotificationCard__preview'
                            dir='auto'
                        >
                            {previewPost ? (
                                previewMessage ? (
                                    <Markdown
                                        message={previewPost.state === Posts.POST_DELETED ? msgDeleted : previewMessage}
                                        options={markdownOptions}
                                        imagesMetadata={previewPost.metadata?.images}
                                        mentionKeys={previewMentionKeys}
                                        imageProps={{
                                            onImageHeightChanged: () => {},
                                            onImageLoaded: () => {},
                                        }}
                                    />
                                ) : (
                                    ensureString(previewPost.props?.override_username) || msgDeleted
                                )
                            ) : (
                                <span>{getPreviewBody(record)}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
