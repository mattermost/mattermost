// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useRef, useState} from 'react';
import {FormattedList, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import type {ValueType} from 'react-select';

import {GenericModal} from '@mattermost/components';
import type {PostPreviewMetadata} from '@mattermost/types/posts';

import {General, Permissions} from 'mattermost-redux/constants';
import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {getPermalinkURL} from 'selectors/urls';

import NotificationBox from 'components/notification_box';
import PostMessagePreview from 'components/post_view/post_message_preview';

import Constants from 'utils/constants';
import {getSiteURL} from 'utils/url';

import type {GlobalState} from 'types/store';

import ForwardPostChannelSelect, {makeSelectedChannelOption} from './forward_post_channel_select';
import type {ChannelOption} from './forward_post_channel_select';
import ForwardPostCommentInput from './forward_post_comment_input';

import type {ActionProps, OwnProps, PropsFromRedux} from './index';

import './forward_post_modal.scss';

export type Props = PropsFromRedux & OwnProps & { actions: ActionProps };

const noop = () => {};

const ForwardPostModal = ({onExited, post, actions}: Props) => {
    const {formatMessage} = useIntl();

    const getChannel = makeGetChannel();

    const channel = useSelector((state: GlobalState) => getChannel(state, {id: post.channel_id}));
    const currentTeam = useSelector(getCurrentTeam);

    const relativePermaLink = useSelector((state: GlobalState) => getPermalinkURL(state, currentTeam.id, post.id));
    const permaLink = `${getSiteURL()}${relativePermaLink}`;

    const isPrivateConversation = channel.type !== Constants.OPEN_CHANNEL;

    const [comment, setComment] = useState('');
    const [bodyHeight, setBodyHeight] = useState<number>(0);
    const [hasError, setHasError] = useState<boolean>(false);
    const [postError, setPostError] = useState<React.ReactNode>(null);
    const [selectedChannel, setSelectedChannel] = useState<ChannelOption>();

    const bodyRef = useRef<HTMLDivElement>();

    const measuredRef = useCallback((node) => {
        if (node !== null) {
            bodyRef.current = node;
            setBodyHeight(node.getBoundingClientRect().height);
        }
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onHeightChange = (width: number, height: number) => {
        if (bodyRef.current) {
            setBodyHeight(bodyRef.current.getBoundingClientRect().height);
        }
    };

    const selectedChannelId = selectedChannel?.details?.id || '';

    const canPostInSelectedChannel = useSelector(
        (state: GlobalState) => {
            const channelId = isPrivateConversation ? channel.id : selectedChannelId;
            const isDMChannel = selectedChannel?.details?.type === Constants.DM_CHANNEL;
            const teamId = isPrivateConversation ? currentTeam.id : selectedChannel?.details?.team_id;

            const hasChannelPermission = haveIChannelPermission(
                state,
                teamId || currentTeam.id,
                channelId,
                Permissions.CREATE_POST,
            );

            return Boolean(channelId) && (hasChannelPermission || isDMChannel);
        },
    );

    const canForwardPost = (isPrivateConversation || canPostInSelectedChannel) && !postError;

    const onHide = useCallback(() => {
        onExited?.();
    }, [onExited]);

    const handleChannelSelect = useCallback(
        (channel: ValueType<ChannelOption>) => {
            if (Array.isArray(channel)) {
                setSelectedChannel(channel[0]);
            }
            setSelectedChannel(channel as ChannelOption);
        },
        [],
    );

    // since the original post has a click handler specified we should prevent any action here
    const preventActionOnPreview = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const messagePreviewTitle = formatMessage({
        id: 'forward_post_modal.preview.title',
        defaultMessage: 'Message preview',
    });

    const previewMetaData: PostPreviewMetadata = {
        post,
        post_id: post.id,
        team_name: currentTeam.name,
        channel_display_name: channel.display_name,
        channel_type: channel.type,
        channel_id: channel.id,
    };

    let notification;
    if (isPrivateConversation) {
        let notificationText;
        if (channel.type === General.PRIVATE_CHANNEL) {
            const channelName = `~${channel.display_name}`;
            notificationText = (
                <FormattedMessage
                    id='forward_post_modal.notification.private_channel'
                    defaultMessage='This message is from a private channel and can only be shared with <strong>{channelName}</strong>'
                    values={{
                        channelName,
                        strong: (x: React.ReactNode) => <strong>{x}</strong>,
                    }}
                />
            );
        } else {
            const allParticipants = channel.display_name.split(', ');
            const participants = allParticipants.map((participant) => <strong key={participant}>{participant}</strong>);

            notificationText = (
                <FormattedMessage
                    id='forward_post_modal.notification.dm_or_gm'
                    defaultMessage='This message is from a private conversation and can only be shared with {participants}'
                    values={{
                        participants: <FormattedList value={participants}/>,
                        strong: (x: React.ReactNode) => <strong>{x}</strong>,
                    }}
                />
            );
        }

        notification = (
            <NotificationBox
                variant={'info'}
                text={notificationText}
                id={'forward_post'}
            />
        );
    }

    const handlePostError = (error: React.ReactNode) => {
        setPostError(error);
        setHasError(true);
        setTimeout(() => setHasError(false), Constants.ANIMATION_TIMEOUT);
    };

    const handleSubmit = () => {
        if (postError) {
            return Promise.resolve();
        }

        const channelToForward = isPrivateConversation ? makeSelectedChannelOption(channel) : selectedChannel;

        if (!channelToForward) {
            return Promise.resolve();
        }

        const {type, userId} = channelToForward.details;

        return Promise.resolve().then(() => {
            if (type === Constants.DM_CHANNEL && userId) {
                return actions.openDirectChannelToUserId(userId);
            }
            return {data: false};
        }).then(({data}) => {
            if (data) {
                channelToForward.details.id = data.id;
            }

            return actions.forwardPost(
                post,
                channelToForward.details,
                comment,
            );
        }).then(() => {
            if (type === Constants.MENTION_MORE_CHANNELS && type === Constants.OPEN_CHANNEL) {
                return actions.joinChannelById(channelToForward.details.id);
            }
            return {data: false};
        }).then(() => {
            // only switch channels when we are not in a private conversation
            if (!isPrivateConversation) {
                return actions.switchToChannel(channelToForward.details);
            }
            return {data: false};
        }).then(() => {
            onHide();
        }).catch((result) => {
            if (result?.error) {
                handlePostError(result.error);
            }
        });
    };

    const postPreviewFooterMessage = formatMessage({
        id: 'forward_post_modal.preview.footer_message',
        defaultMessage: 'Originally posted in ~{channel}',
    },
    {
        channel: channel.display_name,
    });

    return (
        <GenericModal
            className='a11y__modal forward-post'
            id='forward-post-modal'
            show={true}
            autoCloseOnConfirmButton={false}
            compassDesign={true}
            modalHeaderText={formatMessage({
                id: 'forward_post_modal.title',
                defaultMessage: 'Forward message',
            })}
            confirmButtonText={formatMessage({
                id: 'forward_post_modal.button.forward',
                defaultMessage: 'Forward',
            })}
            cancelButtonText={formatMessage({
                id: 'forward_post_modal.button.cancel',
                defaultMessage: 'Cancel',
            })}
            isConfirmDisabled={!canForwardPost}
            handleConfirm={handleSubmit}
            handleCancel={onHide}
            onExited={onHide}
        >
            <div
                className={'forward-post__body'}
                ref={measuredRef}
            >
                {isPrivateConversation ? (
                    notification
                ) : (
                    <ForwardPostChannelSelect
                        onSelect={handleChannelSelect}
                        value={selectedChannel}
                        currentBodyHeight={bodyHeight}
                    />
                )}
                <ForwardPostCommentInput
                    canForwardPost={canForwardPost}
                    channelId={selectedChannelId}
                    comment={comment}
                    onChange={setComment}
                    onError={handlePostError}
                    onSubmit={handleSubmit}
                    onHeightChange={onHeightChange}
                    permaLinkLength={permaLink.length}
                />
                <div className={'forward-post__post-preview'}>
                    <span className={'forward-post__post-preview--title'}>
                        {messagePreviewTitle}
                    </span>
                    <div
                        className='post forward-post__post-preview--override'
                        onClick={preventActionOnPreview}
                    >
                        <PostMessagePreview
                            metadata={previewMetaData}
                            handleFileDropdownOpened={noop}
                            preventClickAction={true}
                            previewFooterMessage={postPreviewFooterMessage}
                        />
                    </div>
                    {postError && (
                        <label
                            className={classNames('post-error', {
                                'animation--highlight': hasError,
                            })}
                        >
                            {postError}
                        </label>
                    )}
                </div>
            </div>
        </GenericModal>
    );
};

export default ForwardPostModal;
