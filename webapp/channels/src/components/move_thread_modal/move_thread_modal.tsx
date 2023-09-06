// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import type {ValueType} from 'react-select';

import type {ClientError} from '@mattermost/client';
import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {Post, PostPreviewMetadata} from '@mattermost/types/posts';

import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import type {ActionResult} from 'mattermost-redux/types/actions';

import type {ChannelOption} from 'components/forward_post_modal/forward_post_channel_select';
import ChannelSelector from 'components/forward_post_modal/forward_post_channel_select';
import NotificationBox from 'components/notification_box';
import PostMessagePreview from 'components/post_view/post_message_preview';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import './move_thread_modal.scss';

export type ActionProps = {

    // join the selected channel when necessary
    joinChannelById: (channelId: string) => Promise<ActionResult>;

    // switch to the selected channel
    switchToChannel: (channel: Channel) => Promise<ActionResult>;

    // action called to move the post from the original channel to a new channel
    moveThread: (postId: string, channelId: string) => Promise<ActionResult>;
}

export type OwnProps = {

    // The function called immediately after the modal is hidden
    onExited?: () => void;

    // the post that is going to be moved
    post: Post;
};

export type Props = OwnProps & {actions: ActionProps};

const noop = () => {};

const getChannel = makeGetChannel();

// since the original post has a click handler specified we should prevent any action here
const preventActionOnPreview = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
};

const MoveThreadModal = ({onExited, post, actions}: Props) => {
    const {formatMessage} = useIntl();

    const originalChannel = useSelector((state: GlobalState) => getChannel(state, {id: post.channel_id}));
    const currentTeam = useSelector(getCurrentTeam);

    const [bodyHeight, setBodyHeight] = useState<number>(0);
    const [hasError, setHasError] = useState<boolean>(false);
    const [postError, setPostError] = useState<React.ReactNode>(null);
    const [selectedChannel, setSelectedChannel] = useState<ChannelOption>();
    const [isButtonClicked, setIsButtonClicked] = useState<boolean>(false);

    const bodyRef = useRef<HTMLDivElement>();

    const measuredRef = useCallback((node) => {
        if (node !== null) {
            bodyRef.current = node;
            setBodyHeight(node.getBoundingClientRect().height);
        }
    }, []);

    const onHide = useCallback(() => {
        onExited?.();
    }, [onExited]);

    const handleChannelSelect = useCallback((channel: ValueType<ChannelOption>) => {
        if (Array.isArray(channel)) {
            setSelectedChannel(channel[0]);
            return;
        }
        setSelectedChannel(channel as ChannelOption);
    },
    [],
    );

    const messagePreviewTitle = formatMessage({
        id: 'move_thread_modal.preview.title',
        defaultMessage: 'Message preview',
    });

    const previewMetaData: PostPreviewMetadata = useMemo(() => ({
        post,
        post_id: post.id,
        team_name: currentTeam.name,
        channel_display_name: originalChannel.display_name,
        channel_type: originalChannel.type,
        channel_id: originalChannel.id,
    }), [post, currentTeam.name, originalChannel.display_name, originalChannel.type, originalChannel.id]);

    const notificationText = formatMessage({
        id: 'move_thread_modal.notification.dm_or_gm',
        defaultMessage: 'Moving this thread changes who has access',
    });

    const notification = (
        <NotificationBox
            variant={'info'}
            text={notificationText}
            id={'move_thread'}
        />
    );
    const handlePostError = useCallback((error: ClientError) => {
        setIsButtonClicked(false);
        setPostError(error.message);
        setHasError(true);
        setTimeout(() => setHasError(false), Constants.ANIMATION_TIMEOUT);
    }, [setIsButtonClicked, setPostError, setHasError]);

    const handleSubmit = useCallback(async () => {
        setIsButtonClicked(true);
        if (!selectedChannel) {
            setIsButtonClicked(false);
            return;
        }

        const channel = selectedChannel.details;

        let result = await actions.moveThread(post.root_id || post.id, channel.id);

        if (result.error) {
            handlePostError(result.error);
            return;
        }

        if (
            channel.type === Constants.MENTION_MORE_CHANNELS &&
            channel.type === Constants.OPEN_CHANNEL
        ) {
            result = await actions.joinChannelById(channel.id);

            if (result.error) {
                handlePostError(result.error);
                return;
            }
        }

        result = await actions.switchToChannel(channel);

        if (result.error) {
            handlePostError(result.error);
            return;
        }

        onHide();
    }, [setIsButtonClicked, selectedChannel, post, actions, handlePostError, onHide]);

    const postPreviewFooterMessage = formatMessage({
        id: 'move_thread_modal.preview.footer_message',
        defaultMessage: 'Originally posted in ~{channelName}',
    },
    {
        channelName: originalChannel.display_name,
    });

    return (
        <GenericModal
            className='a11y__modal forward-post move-thread'
            id='move-thread-modal'
            show={true}
            autoCloseOnConfirmButton={false}
            compassDesign={true}
            modalHeaderText={formatMessage({
                id: 'move_thread_modal.title',
                defaultMessage: 'Move thread',
            })}
            confirmButtonText={formatMessage({
                id: 'move_thread_modal.button.forward',
                defaultMessage: 'Move',
            })}
            cancelButtonText={formatMessage({
                id: 'move_thread_modal.button.cancel',
                defaultMessage: 'Cancel',
            })}
            isConfirmDisabled={isButtonClicked}
            handleConfirm={handleSubmit}
            handleEnterKeyPress={handleSubmit}
            handleCancel={onHide}
            onExited={onHide}
        >
            <div
                className={'move-thread__body'}
                ref={measuredRef}
            >
                {notification}
                <ChannelSelector
                    onSelect={handleChannelSelect}
                    value={selectedChannel}
                    currentBodyHeight={bodyHeight}
                    validChannelTypes={['O', 'P']}
                />
                <div className={'move-thread__post-preview'}>
                    <span className={'move-thread__post-preview--title'}>
                        {messagePreviewTitle}
                    </span>
                    <div
                        className='post move-thread__post-preview--override'
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

export default MoveThreadModal;
