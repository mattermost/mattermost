// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelJoinRequest, ChannelJoinRequestApprovalResponse} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {
    requestJoinChannel as requestJoinChannelAction,
    withdrawMyChannelJoinRequest as withdrawMyChannelJoinRequestAction,
} from 'mattermost-redux/actions/channels';
import {getMyPendingJoinRequest} from 'mattermost-redux/selectors/entities/channels';

import {getHistory} from 'utils/browser_history';
import {getRelativeChannelURL} from 'utils/url';

import type {GlobalState} from 'types/store';

import './request_join_channel_modal.scss';

export type Props = {
    channel: Channel;

    // Optional — used as the redirect target after a successful ABAC
    // fast-path join. The Browse Channels modal passes this in;
    // dependencies without it (e.g. Quick Switch in PR 4) can omit it
    // and the modal will simply close on success.
    teamName?: string;

    onExited?: () => void;
};

export default function RequestJoinChannelModal({channel, teamName, onExited}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const existingRequest = useSelector<GlobalState, ChannelJoinRequest | undefined>(
        (state) => getMyPendingJoinRequest(state, channel.id),
    );

    const [show, setShow] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const handleHide = useCallback(() => setShow(false), []);

    const modalTitle = formatMessage({
        id: 'request_join_channel.title',
        defaultMessage: 'Request to join channel',
    });

    const mapServerError = (err: ServerError): string => {
        const errId = (err as ServerError & {server_error_id?: string})?.server_error_id;
        switch (errId) {
        case 'api.channel.discoverable_join_request.guest.app_error':
            return formatMessage({id: 'request_join_channel.error.guest', defaultMessage: 'Guests cannot request to join channels.'});
        case 'api.channel.discoverable_join_request.duplicate.app_error':
            return formatMessage({id: 'request_join_channel.error.duplicate', defaultMessage: 'You already have a pending request for this channel.'});
        case 'api.channel.discoverable_join_request.policy_denied.app_error':
            return formatMessage({id: 'request_join_channel.error.policy_denied', defaultMessage: 'You don\'t match this channel\'s Membership Policy.'});
        case 'api.channel.discoverable_join_request.already_member.app_error':
            return formatMessage({id: 'request_join_channel.error.already_member', defaultMessage: 'You\'re already a member of this channel.'});
        default:
            return err.message || formatMessage({id: 'request_join_channel.error.generic', defaultMessage: 'Something went wrong. Please try again.'});
        }
    };

    const handleSubmit = useCallback(async () => {
        setSubmitting(true);
        setServerError(null);
        const result = await dispatch(requestJoinChannelAction(channel.id, ''));
        setSubmitting(false);
        if (result?.error) {
            setServerError(mapServerError(result.error as ServerError));
            return;
        }

        const data = result?.data as ChannelJoinRequest | ChannelJoinRequestApprovalResponse | undefined;
        const joined = data && (data as ChannelJoinRequest).id === undefined;
        if (joined && teamName) {
            getHistory().push(getRelativeChannelURL(teamName, channel.name));
        }
        handleHide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel.id, channel.name, teamName]);

    const handleWithdraw = useCallback(async () => {
        setSubmitting(true);
        setServerError(null);
        const result = await dispatch(withdrawMyChannelJoinRequestAction(channel.id));
        setSubmitting(false);
        if (result?.error) {
            setServerError(mapServerError(result.error as ServerError));
            return;
        }
        handleHide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel.id]);

    const isPending = Boolean(existingRequest);

    const body = isPending ? (
        <p
            className='RequestJoinChannelModal__copy'
            role='status'
            aria-live='polite'
        >
            <FormattedMessage
                id='request_join_channel.pending_body'
                defaultMessage='Your request to join {channelName} has been sent. A channel admin will review it. Track updates in Browse Channels under My pending requests.'
                values={{channelName: channel.display_name}}
            />
        </p>
    ) : (
        <p className='RequestJoinChannelModal__copy'>
            <FormattedMessage
                id='request_join_channel.body'
                defaultMessage='A channel admin will review your request. Track updates in Browse Channels under My pending requests. You can withdraw your request at any time.'
            />
        </p>
    );

    return (
        <GenericModal
            id='requestJoinChannelModal'
            show={show}
            onExited={onExited}
            onHide={handleHide}
            compassDesign={true}
            isStacked={true}
            modalHeaderText={
                <span className='RequestJoinChannelModal__header'>
                    <span className='RequestJoinChannelModal__header-title'>
                        {modalTitle}
                    </span>
                    <span
                        className='RequestJoinChannelModal__header-separator'
                        aria-hidden='true'
                    />
                    <span className='RequestJoinChannelModal__header-channel'>
                        {channel.display_name}
                    </span>
                </span>
            }
            confirmButtonText={isPending ?
                formatMessage({id: 'request_join_channel.withdraw', defaultMessage: 'Withdraw request'}) :
                formatMessage({id: 'request_join_channel.send', defaultMessage: 'Send Request'})
            }
            confirmButtonVariant={isPending ? 'destructive' : ''}
            cancelButtonText={formatMessage({id: 'request_join_channel.cancel', defaultMessage: 'Cancel'})}
            handleConfirm={isPending ? handleWithdraw : handleSubmit}
            handleCancel={handleHide}
            autoCloseOnConfirmButton={false}
            autoFocusConfirmButton={false}
            isConfirmDisabled={submitting}
            errorText={serverError ?? undefined}
            dataTestId='request-join-channel-modal'
        >
            <div className='RequestJoinChannelModal__body'>
                {body}
            </div>
        </GenericModal>
    );
}
