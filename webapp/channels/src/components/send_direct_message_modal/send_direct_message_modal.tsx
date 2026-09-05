// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {UserProfile} from '@mattermost/types/users';

import {createPost} from 'mattermost-redux/actions/posts';

import {openDirectChannelToUserId} from 'actions/channel_actions';

import './send_direct_message_modal.scss';

type Props = {
    user: UserProfile;
    onExited: () => void;
}

// Lightweight modal that lets an admin (or anyone with the user popover open)
// compose and send a direct message to a user without navigating away from the
// current page. Fixes issue #33750 — clicking "Message" from the System Console
// user popover used to call getHistory().push(...) into a team-prefixed DM URL
// that doesn't resolve from the admin console route, so the click silently
// did nothing.
const SendDirectMessageModal = ({user, onExited}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState('');

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        // Autofocus the textarea once the modal is mounted.
        textareaRef.current?.focus();
    }, []);

    const title = formatMessage(
        {id: 'send_direct_message_modal.title', defaultMessage: 'Send a message to @{username}'},
        {username: user.username},
    );
    const placeholder = formatMessage({
        id: 'send_direct_message_modal.placeholder',
        defaultMessage: 'Write a message…',
    });
    const sendLabel = formatMessage({
        id: 'send_direct_message_modal.send',
        defaultMessage: 'Send message',
    });
    const cancelLabel = formatMessage({
        id: 'send_direct_message_modal.cancel',
        defaultMessage: 'Cancel',
    });

    const handleSend = useCallback(async () => {
        const trimmed = message.trim();
        if (!trimmed || submitting) {
            return;
        }

        setSubmitting(true);
        setErrorText('');

        try {
            const result: {data?: {id: string}; error?: Error} = await dispatch(openDirectChannelToUserId(user.id));
            if (result.error || !result.data) {
                throw result.error || new Error('Failed to open direct channel');
            }
            const channelId = result.data.id;

            // createPost dispatches optimistically and returns before the
            // server confirms the write. Wait on its afterSubmit callback so
            // we only close the modal after the post actually succeeded.
            await new Promise<void>((resolve, reject) => {
                dispatch(createPost(
                    {
                        channel_id: channelId,
                        message: trimmed,
                    } as any,
                    [],
                    (response: {created?: unknown; error?: unknown}) => {
                        if (response?.error) {
                            reject(response.error);
                            return;
                        }
                        resolve();
                    },
                ));
            });

            onExited();
        } catch (err) {
            setErrorText(formatMessage({
                id: 'send_direct_message_modal.error',
                defaultMessage: 'Failed to send message. Please try again.',
            }));
            setSubmitting(false);
        }
    }, [dispatch, message, submitting, user.id, onExited, formatMessage]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        if (errorText) {
            setErrorText('');
        }
    }, [errorText]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Cmd/Ctrl+Enter sends the message — matches Mattermost's usual
        // "send on Enter" convention without trapping plain Enter (so users
        // can still insert newlines if they want).
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    return (
        <GenericModal
            id='SendDirectMessageModal'
            ariaLabel={title}
            modalHeaderText={title}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleSend}
            handleCancel={onExited}
            confirmButtonText={sendLabel}
            cancelButtonText={cancelLabel}
            onExited={onExited}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={submitting || message.trim().length === 0}
        >
            <div className='SendDirectMessageModal__body'>
                <textarea
                    ref={textareaRef}
                    className='SendDirectMessageModal__textarea form-control'
                    value={message}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    rows={4}
                    disabled={submitting}
                    aria-label={title}
                />
                {errorText && (
                    <div className='SendDirectMessageModal__error'>
                        <i className='icon icon-alert-outline'/>
                        <FormattedMessage
                            id='send_direct_message_modal.error'
                            defaultMessage='Failed to send message. Please try again.'
                        />
                    </div>
                )}
            </div>
        </GenericModal>
    );
};

export default SendDirectMessageModal;
