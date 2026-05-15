// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {AccountOutlineIcon, LockOutlineIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelJoinRequest, ChannelJoinRequestStatus} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {requestJoinChannel, withdrawChannelJoinRequest} from 'mattermost-redux/actions/channel_join_requests';
import {getMyChannelJoinRequestForChannel} from 'mattermost-redux/selectors/entities/channel_join_requests';

import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './request_join_channel_modal.scss';

const MESSAGE_MAX_RUNES = 500;

// Counts unicode code points, not UTF-16 surrogate halves, so the limit
// applies to user-perceived characters and matches the server-side rune
// constraint.
function countRunes(str: string): number {
    return Array.from(str).length;
}

type Props = {
    channel: Channel;
    memberCount?: number;
    onJoined?: () => void;
};

function RequestJoinChannelModal({channel, memberCount, onJoined}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const existingRequest = useSelector((state: GlobalState) => getMyChannelJoinRequestForChannel(state, channel.id));

    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const runeCount = useMemo(() => countRunes(message), [message]);
    const overLimit = runeCount > MESSAGE_MAX_RUNES;
    const hasPending = Boolean(existingRequest && existingRequest.status === 'pending');

    const handleClose = useCallback(() => {
        dispatch(closeModal(ModalIdentifiers.REQUEST_JOIN_CHANNEL));
    }, [dispatch]);

    // Submit returns true when the modal should close itself afterwards.
    const handleSubmit = useCallback(async () => {
        if (overLimit || submitting || hasPending) {
            return;
        }
        setSubmitting(true);
        setServerError(null);

        const {data, error} = await dispatch(requestJoinChannel(channel.id, message.trim()));
        setSubmitting(false);

        if (error) {
            const err = error as ServerError;

            // Surface the server message verbatim — the API uses i18n keys
            // for all the 403/409 paths, so the translated message is
            // already user-appropriate.
            setServerError(err.message || formatMessage(messages.genericError));
            return;
        }

        // ABAC fast path: server added the membership directly.
        if (data && !(data as ChannelJoinRequest).id && (data as {status: ChannelJoinRequestStatus}).status === 'approved') {
            handleClose();
            onJoined?.();
        }
    }, [overLimit, submitting, hasPending, dispatch, channel.id, message, formatMessage, handleClose, onJoined]);

    const handleWithdraw = useCallback(async () => {
        if (!hasPending) {
            return;
        }
        setSubmitting(true);
        setServerError(null);

        const {error} = await dispatch(withdrawChannelJoinRequest(channel.id));
        setSubmitting(false);
        if (error) {
            const err = error as ServerError;
            setServerError(err.message || formatMessage(messages.genericError));
            return;
        }
        handleClose();
    }, [hasPending, dispatch, channel.id, formatMessage, handleClose]);

    const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        if (serverError) {
            setServerError(null);
        }
    }, [serverError]);

    const confirmText = hasPending ?
        formatMessage(messages.withdrawButton) :
        formatMessage(messages.requestButton);
    const handleConfirm = hasPending ? handleWithdraw : handleSubmit;

    return (
        <GenericModal
            id='requestJoinChannelModal'
            className='request-join-channel-modal'
            compassDesign={true}
            modalHeaderText={hasPending ?
                formatMessage(messages.headingPending) :
                formatMessage(messages.heading, {channelName: channel.display_name})
            }
            confirmButtonText={confirmText}
            cancelButtonText={formatMessage(messages.cancelButton)}
            isConfirmDisabled={submitting || overLimit}
            autoCloseOnConfirmButton={false}
            handleConfirm={handleConfirm}
            handleCancel={handleClose}
            onExited={handleClose}
            errorText={serverError ?? undefined}
        >
            <div className='request-join-channel-modal__body'>
                <section className='request-join-channel-modal__channel'>
                    <div className='request-join-channel-modal__channel-name'>
                        <LockOutlineIcon size={18}/>
                        <span>{channel.display_name}</span>
                    </div>
                    {(typeof memberCount === 'number' && memberCount > 0) && (
                        <div className='request-join-channel-modal__metadata'>
                            <AccountOutlineIcon size={14}/>
                            <FormattedMessage
                                id='request_join_channel.member_count'
                                defaultMessage='{count, plural, one {# member} other {# members}}'
                                values={{count: memberCount}}
                            />
                        </div>
                    )}
                    {channel.purpose && (
                        <p className='request-join-channel-modal__purpose'>
                            <strong>
                                <FormattedMessage
                                    id='request_join_channel.purpose_label'
                                    defaultMessage='Purpose'
                                />
                            </strong>
                            <span>{channel.purpose}</span>
                        </p>
                    )}
                    {channel.header && (
                        <p className='request-join-channel-modal__header'>
                            <strong>
                                <FormattedMessage
                                    id='request_join_channel.header_label'
                                    defaultMessage='Header'
                                />
                            </strong>
                            <span>{channel.header}</span>
                        </p>
                    )}
                </section>

                {hasPending ? (
                    <p className='request-join-channel-modal__pending'>
                        <FormattedMessage
                            id='request_join_channel.pending_body'
                            defaultMessage='You have a request to join this channel awaiting admin approval. Withdraw it if you no longer want to join.'
                        />
                    </p>
                ) : (
                    <>
                        <p className='request-join-channel-modal__intro'>
                            <FormattedMessage
                                id='request_join_channel.intro'
                                defaultMessage='Send an optional message to channel admins explaining why you would like to join. They will approve or deny your request.'
                            />
                        </p>
                        <label
                            className='request-join-channel-modal__label'
                            htmlFor='requestJoinChannelMessage'
                        >
                            <FormattedMessage
                                id='request_join_channel.message_label'
                                defaultMessage='Message (optional)'
                            />
                        </label>
                        <textarea
                            id='requestJoinChannelMessage'
                            className='request-join-channel-modal__textarea'
                            value={message}
                            onChange={handleMessageChange}
                            rows={4}
                            disabled={submitting}
                            placeholder={formatMessage(messages.messagePlaceholder)}
                            aria-invalid={overLimit}
                        />
                        <div className='request-join-channel-modal__counter'>
                            <span
                                className={overLimit ? 'over-limit' : undefined}
                                aria-live='polite'
                            >
                                <FormattedMessage
                                    id='request_join_channel.counter'
                                    defaultMessage='{count}/{max} characters'
                                    values={{count: runeCount, max: MESSAGE_MAX_RUNES}}
                                />
                            </span>
                        </div>
                    </>
                )}
            </div>
        </GenericModal>
    );
}

const messages = defineMessages({
    heading: {
        id: 'request_join_channel.heading',
        defaultMessage: 'Request to join {channelName}',
    },
    headingPending: {
        id: 'request_join_channel.heading_pending',
        defaultMessage: 'Withdraw join request',
    },
    requestButton: {
        id: 'request_join_channel.request_button',
        defaultMessage: 'Send Request',
    },
    withdrawButton: {
        id: 'request_join_channel.withdraw_button',
        defaultMessage: 'Withdraw',
    },
    cancelButton: {
        id: 'request_join_channel.cancel_button',
        defaultMessage: 'Cancel',
    },
    messagePlaceholder: {
        id: 'request_join_channel.message_placeholder',
        defaultMessage: 'Tell admins why you’d like to join (optional)',
    },
    genericError: {
        id: 'request_join_channel.error_generic',
        defaultMessage: 'Something went wrong. Please try again.',
    },
});

export default RequestJoinChannelModal;
