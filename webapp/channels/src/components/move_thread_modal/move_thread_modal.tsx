// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';

import {FormattedMessage, useIntl} from 'react-intl';

import {useSelector} from 'react-redux';

import {ValueType} from 'react-select';

import classNames from 'classnames';

import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import NotificationBox from 'components/notification_box';

import {GlobalState} from 'types/store';

import Constants from 'utils/constants';

import PostMessagePreview from 'components/post_view/post_message_preview';
import {GenericModal} from '@mattermost/components';

import {ActionResult} from 'mattermost-redux/types/actions';

import {Post, PostPreviewMetadata} from '@mattermost/types/posts';
import {Channel} from '@mattermost/types/channels';

import ForwardPostChannelSelect, {ChannelOption} from '../forward_post_modal/forward_post_channel_select';

import '../forward_post_modal/forward_post_modal.scss';
import {ClientError} from '@mattermost/client';

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

    // TODO: modify when threads are movable based on config settings (instead of always being able to)
    const canMoveThread = true;

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
        id: 'move_thread_modal.preview.title',
        defaultMessage: 'Message preview',
    });

    const previewMetaData: PostPreviewMetadata = {
        post,
        post_id: post.id,
        team_name: currentTeam.name,
        channel_display_name: originalChannel.display_name,
        channel_type: originalChannel.type,
        channel_id: originalChannel.id,
    };

    const notificationText = (
        <FormattedMessage
            id='move_thread_modal.notification.dm_or_gm'
            defaultMessage='Moving this thread changes who has access' // localization?
            values={{
                strong: (x: React.ReactNode) => <strong>{x}</strong>,
            }}
        />
    );

    const notification = (
        <NotificationBox
            variant={'info'}
            text={notificationText}
            id={'move_thread'}
        />
    );

    const handlePostError = (error: ClientError) => {
        setIsButtonClicked(false);
        setPostError(error.message);
        setHasError(true);
        setTimeout(() => setHasError(false), Constants.ANIMATION_TIMEOUT);
    };

    const handleSubmit = async () => {
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
    };

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
            id='forward-post-modal'
            show={true}

            // enforceFocus={false}
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
            isConfirmDisabled={!canMoveThread || isButtonClicked}
            handleConfirm={handleSubmit}
            handleEnterKeyPress={handleSubmit}
            handleCancel={onHide}
            onExited={onHide}
        >
            <div
                className={'forward-post__body'}
                ref={measuredRef}
            >
                {notification}
                <ForwardPostChannelSelect
                    onSelect={handleChannelSelect}
                    value={selectedChannel}
                    currentBodyHeight={bodyHeight}
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
                            previewPost={previewMetaData.post}
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
