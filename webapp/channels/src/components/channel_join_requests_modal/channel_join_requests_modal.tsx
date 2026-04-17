// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {ChannelJoinRequest} from '@mattermost/types/channels';

import {Client4} from 'mattermost-redux/client';

import LoadingScreen from 'components/loading_screen';

import './channel_join_requests_modal.scss';

type Props = {
    channelId: string;
    channelDisplayName: string;
    onExited: () => void;
};

export default function ChannelJoinRequestsModal({channelId, channelDisplayName, onExited}: Props) {
    const {formatMessage, formatDate} = useIntl();
    const [requests, setRequests] = useState<ChannelJoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [usernames, setUsernames] = useState<Record<string, string>>({});
    const [processingId, setProcessingId] = useState('');

    const loadRequests = useCallback(async () => {
        setLoading(true);
        try {
            const data = await Client4.getChannelJoinRequests(channelId, 'pending');
            const requests = data || [];
            setRequests(requests);

            const userIds = requests.map((r: ChannelJoinRequest) => r.user_id);
            if (userIds.length > 0) {
                const profiles = await Client4.getProfilesByIds(userIds);
                const names: Record<string, string> = {};
                for (const profile of profiles) {
                    names[profile.id] = profile.username;
                }
                setUsernames(names);
            }
        } catch {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [channelId]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleAction = useCallback(async (requestId: string, status: 'approved' | 'denied') => {
        setProcessingId(requestId);
        try {
            await Client4.updateChannelJoinRequest(channelId, requestId, status);
            setRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch {
            // ignore for MVP
        } finally {
            setProcessingId('');
        }
    }, [channelId]);

    const title = formatMessage(
        {id: 'channel_join_requests.title', defaultMessage: 'Join Requests — {channelName}'},
        {channelName: channelDisplayName},
    );

    const body = loading ? <LoadingScreen/> : (
        <div className='ChannelJoinRequestsModal__body'>
            {requests.length === 0 ? (
                <div className='ChannelJoinRequestsModal__empty'>
                    <FormattedMessage
                        id='channel_join_requests.empty'
                        defaultMessage='No pending join requests.'
                    />
                </div>
            ) : (
                requests.map((request) => (
                    <div
                        key={request.id}
                        className='ChannelJoinRequestsModal__row'
                    >
                        <div className='ChannelJoinRequestsModal__userInfo'>
                            <strong>{'@'}{usernames[request.user_id] || request.user_id}</strong>
                            <span className='ChannelJoinRequestsModal__date'>
                                {formatDate(request.create_at, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: 'numeric',
                                })}
                            </span>
                        </div>
                        <div className='ChannelJoinRequestsModal__actions'>
                            <button
                                className='btn btn-sm btn-primary'
                                disabled={processingId === request.id}
                                onClick={() => handleAction(request.id, 'approved')}
                            >
                                {formatMessage({id: 'channel_join_requests.approve', defaultMessage: 'Approve'})}
                            </button>
                            <button
                                className='btn btn-sm btn-tertiary'
                                disabled={processingId === request.id}
                                onClick={() => handleAction(request.id, 'denied')}
                            >
                                {formatMessage({id: 'channel_join_requests.deny', defaultMessage: 'Deny'})}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <GenericModal
            id='channelJoinRequestsModal'
            onExited={onExited}
            modalHeaderText={title}
            compassDesign={true}
            autoCloseOnConfirmButton={false}
            aria-modal={true}
            enforceFocus={false}
            bodyPadding={false}
        >
            {body}
        </GenericModal>
    );
}
