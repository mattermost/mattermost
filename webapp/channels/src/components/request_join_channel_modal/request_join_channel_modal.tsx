// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import {Client4} from 'mattermost-redux/client';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import './request_join_channel_modal.scss';

type Props = {
    channel: Channel;
    onExited: () => void;
    onJoined?: () => void;
};

type ModalState = 'loading' | 'confirm' | 'submitting' | 'pending' | 'approved' | 'withdrawn' | 'error';

export default function RequestJoinChannelModal({channel, onExited, onJoined}: Props) {
    const {formatMessage} = useIntl();
    const [state, setState] = useState<ModalState>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    // Check on mount if user already has a pending request
    useEffect(() => {
        Client4.getMyJoinRequest(channel.id).then((existing) => {
            if (existing && existing.status === 'pending') {
                setState('pending');
            } else {
                setState('confirm');
            }
        });
    }, [channel.id]);

    const handleSubmit = useCallback(async () => {
        setState('submitting');
        try {
            const data = await Client4.requestJoinChannel(channel.id);
            if (data.status === 'approved') {
                setState('approved');
                setTimeout(() => {
                    onJoined?.();
                    onExited();
                }, 1200);
            } else {
                // 'pending' -- either newly created or already existed
                setState('pending');
            }
        } catch (err: any) {
            setState('error');
            setErrorMsg(err?.message || 'Something went wrong.');
        }
    }, [channel.id, onExited, onJoined]);

    const handleWithdraw = useCallback(async () => {
        setState('submitting');
        try {
            await Client4.withdrawJoinRequest(channel.id);
            setState('withdrawn');
        } catch (err: any) {
            setState('error');
            setErrorMsg(err?.message || 'Failed to withdraw request.');
        }
    }, [channel.id]);

    // Loading / Submitting
    if (state === 'loading' || state === 'submitting') {
        return (
            <GenericModal
                id='requestJoinChannelModal'
                onExited={onExited}
                modalHeaderText={formatMessage({id: 'request_join_channel.title', defaultMessage: 'Request to Join Channel'})}
                compassDesign={true}
            >
                <div className='RequestJoinChannelModal__body'>
                    <LoadingWrapper
                        loading={true}
                        text={formatMessage({id: 'request_join_channel.processing', defaultMessage: 'Processing...'})}
                    >
                        <span/>
                    </LoadingWrapper>
                </div>
            </GenericModal>
        );
    }

    // Auto-approved (ABAC)
    if (state === 'approved') {
        return (
            <GenericModal
                id='requestJoinChannelModal'
                onExited={onExited}
                modalHeaderText={formatMessage({id: 'request_join_channel.approved_title', defaultMessage: 'Joined!'})}
                compassDesign={true}
                confirmButtonText={formatMessage({id: 'request_join_channel.close', defaultMessage: 'Close'})}
                handleConfirm={onExited}
            >
                <div className='RequestJoinChannelModal__body'>
                    <div className='RequestJoinChannelModal__icon RequestJoinChannelModal__icon--success'>
                        <i className='icon icon-check'/>
                    </div>
                    <p className='RequestJoinChannelModal__message'>
                        <FormattedMessage
                            id='request_join_channel.approved_message'
                            defaultMessage='You have been added to {channelName}.'
                            values={{channelName: <strong>{channel.display_name}</strong>}}
                        />
                    </p>
                </div>
            </GenericModal>
        );
    }

    // Withdrawn
    if (state === 'withdrawn') {
        return (
            <GenericModal
                id='requestJoinChannelModal'
                onExited={onExited}
                modalHeaderText={formatMessage({id: 'request_join_channel.withdrawn_title', defaultMessage: 'Request Withdrawn'})}
                compassDesign={true}
                confirmButtonText={formatMessage({id: 'request_join_channel.done', defaultMessage: 'Done'})}
                handleConfirm={onExited}
            >
                <div className='RequestJoinChannelModal__body'>
                    <p className='RequestJoinChannelModal__message'>
                        <FormattedMessage
                            id='request_join_channel.withdrawn_message'
                            defaultMessage='Your request to join {channelName} has been withdrawn.'
                            values={{channelName: <strong>{channel.display_name}</strong>}}
                        />
                    </p>
                </div>
            </GenericModal>
        );
    }

    // Pending -- show withdraw option
    if (state === 'pending') {
        return (
            <GenericModal
                id='requestJoinChannelModal'
                onExited={onExited}
                modalHeaderText={formatMessage({id: 'request_join_channel.pending_title', defaultMessage: 'Request Pending'})}
                compassDesign={true}
                confirmButtonText={formatMessage({id: 'request_join_channel.withdraw', defaultMessage: 'Withdraw Request'})}
                cancelButtonText={formatMessage({id: 'request_join_channel.done', defaultMessage: 'Done'})}
                handleConfirm={handleWithdraw}
                isDeleteModal={true}
                autoCloseOnConfirmButton={false}
            >
                <div className='RequestJoinChannelModal__body'>
                    <div className='RequestJoinChannelModal__channelInfo'>
                        <LockOutlineIcon size={20}/>
                        <span className='RequestJoinChannelModal__channelName'>{channel.display_name}</span>
                    </div>
                    <div className='RequestJoinChannelModal__icon RequestJoinChannelModal__icon--pending'>
                        <i className='icon icon-clock-outline'/>
                    </div>
                    <p className='RequestJoinChannelModal__message'>
                        <FormattedMessage
                            id='request_join_channel.pending_message'
                            defaultMessage='Your request to join this channel is pending approval from a channel admin. You can withdraw your request if you change your mind.'
                        />
                    </p>
                </div>
            </GenericModal>
        );
    }

    // Error
    if (state === 'error') {
        return (
            <GenericModal
                id='requestJoinChannelModal'
                onExited={onExited}
                modalHeaderText={formatMessage({id: 'request_join_channel.error_title', defaultMessage: 'Error'})}
                compassDesign={true}
                confirmButtonText={formatMessage({id: 'request_join_channel.done', defaultMessage: 'Done'})}
                handleConfirm={onExited}
            >
                <div className='RequestJoinChannelModal__body'>
                    <div className='RequestJoinChannelModal__error'>
                        {errorMsg}
                    </div>
                </div>
            </GenericModal>
        );
    }

    // Confirm screen -- user clicks to submit
    return (
        <GenericModal
            id='requestJoinChannelModal'
            onExited={onExited}
            modalHeaderText={formatMessage({id: 'request_join_channel.title', defaultMessage: 'Request to Join Channel'})}
            compassDesign={true}
            confirmButtonText={formatMessage({id: 'request_join_channel.confirm', defaultMessage: 'Request to Join'})}
            cancelButtonText={formatMessage({id: 'request_join_channel.cancel', defaultMessage: 'Cancel'})}
            handleConfirm={handleSubmit}
            autoCloseOnConfirmButton={false}
        >
            <div className='RequestJoinChannelModal__body'>
                <div className='RequestJoinChannelModal__channelInfo'>
                    <LockOutlineIcon size={20}/>
                    <span className='RequestJoinChannelModal__channelName'>{channel.display_name}</span>
                </div>
                {channel.purpose && (
                    <p className='RequestJoinChannelModal__purpose'>{channel.purpose}</p>
                )}
                <p className='RequestJoinChannelModal__message'>
                    <FormattedMessage
                        id='request_join_channel.description'
                        defaultMessage='This is a private channel. A channel admin will need to approve your request before you can access it.'
                    />
                </p>
            </div>
        </GenericModal>
    );
}
