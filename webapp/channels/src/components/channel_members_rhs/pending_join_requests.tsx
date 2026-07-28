// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {ChannelJoinRequest} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {
    countPendingChannelJoinRequests,
    getChannelJoinRequests,
    patchChannelJoinRequest,
} from 'mattermost-redux/actions/channels';
import {getProfilesByIds, ProfilesInChannelSortBy} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {loadProfilesAndReloadChannelMembers} from 'actions/user_actions';

import ConfirmModal from 'components/confirm_modal';
import ProfilePicture from 'components/profile_picture';
import ProfilePopover from 'components/profile_popover';
import Timestamp from 'components/timestamp/timestamp';

import type {GlobalState} from 'types/store';

import './pending_join_requests.scss';

const MEMBERS_PAGE_SIZE = 100;

function mapReviewError(
    err: ServerError,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
): string {
    switch (err.server_error_id) {
    case 'api.channel.discoverable_join_request.not_pending.app_error':
        return formatMessage({
            id: 'channel_join_request.review.error.not_pending',
            defaultMessage: 'This request is no longer pending.',
        });
    case 'app.channel.join_request.not_found.app_error':
        return formatMessage({
            id: 'channel_join_request.review.error.not_found',
            defaultMessage: 'This request could not be found. The list has been refreshed.',
        });
    case 'api.channel.discoverable_join_request.feature_disabled.app_error':
        return formatMessage({
            id: 'channel_join_request.review.error.feature_disabled',
            defaultMessage: 'Discoverable channels are not enabled on this server.',
        });
    default:
        return err.message || formatMessage({
            id: 'channel_join_request.review.error.generic',
            defaultMessage: 'Something went wrong. Please try again.',
        });
    }
}

function shouldRefreshQueueAfterReviewError(err: ServerError): boolean {
    switch (err.server_error_id) {
    case 'api.channel.discoverable_join_request.not_pending.app_error':
    case 'app.channel.join_request.not_found.app_error':
        return true;
    default:
        return false;
    }
}

type Props = {
    channelId: string;
    requests: ChannelJoinRequest[];
};

type PendingJoinRequestRowProps = {
    channelId: string;
    request: ChannelJoinRequest;
    user?: UserProfile;
    displayName: string;
};

function PendingJoinRequestRow({
    channelId,
    request,
    user,
    displayName,
}: PendingJoinRequestRowProps) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channelDisplayName = useSelector((state: GlobalState) => getChannel(state, channelId)?.display_name ?? '');
    const [approving, setApproving] = useState(false);
    const [denying, setDenying] = useState(false);
    const [showDenyConfirm, setShowDenyConfirm] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const userProfileSrc = Client4.getProfilePictureUrl(request.user_id, user?.last_picture_update ?? 0);

    const refreshQueue = useCallback(async () => {
        await Promise.all([
            dispatch(getChannelJoinRequests(channelId, {status: 'pending'})),
            dispatch(countPendingChannelJoinRequests(channelId)),
        ]);
    }, [channelId, dispatch]);

    const refreshAfterReview = useCallback(async (approved: boolean) => {
        await refreshQueue();
        if (approved) {
            await dispatch(loadProfilesAndReloadChannelMembers(
                0,
                MEMBERS_PAGE_SIZE,
                channelId,
                ProfilesInChannelSortBy.Admin,
                {},
                true,
            ));
        }
    }, [channelId, dispatch, refreshQueue]);

    const reviewRequest = useCallback(async (status: 'approved' | 'denied') => {
        setActionError(null);
        const result = await dispatch(patchChannelJoinRequest(channelId, request.id, {status}));
        if (result?.error) {
            const serverError = result.error as ServerError;
            if (shouldRefreshQueueAfterReviewError(serverError)) {
                await refreshQueue();
            }
            setActionError(mapReviewError(serverError, formatMessage));
            return false;
        }
        await refreshAfterReview(status === 'approved');
        return true;
    }, [channelId, dispatch, formatMessage, refreshAfterReview, refreshQueue, request.id]);

    const handleApprove = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        setApproving(true);
        try {
            await reviewRequest('approved');
        } finally {
            setApproving(false);
        }
    }, [reviewRequest]);

    const handleDenyClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDenyConfirm(true);
    }, []);

    const handleDenyConfirm = useCallback(async () => {
        setDenying(true);
        try {
            await reviewRequest('denied');
        } finally {
            setDenying(false);

            // Always close the confirmation modal so a failure's inline error
            // in the row is visible rather than hidden behind the dialog.
            setShowDenyConfirm(false);
        }
    }, [reviewRequest]);

    return (
        <>
            <div
                className='channel-members-rhs__member channel-members-rhs__pending-request'
                data-testid={`pending-join-request-${request.id}`}
            >
                <ProfilePopover
                    triggerComponentClass='channel-members-rhs__pending-request-profile'
                    userId={request.user_id}
                    src={userProfileSrc}
                    hideStatus={user?.is_bot}
                >
                    <div className='channel-members-rhs__avatar'>
                        <ProfilePicture
                            size='sm'
                            userId={request.user_id}
                            username={displayName}
                            src={userProfileSrc}
                        />
                    </div>
                    <div className='channel-members-rhs__pending-request-details'>
                        <div className='channel-members-rhs__pending-request-primary'>
                            <span className='channel-members-rhs__display-name'>
                                {displayName}
                            </span>
                            {user && displayName !== user.username && (
                                <span className='channel-members-rhs__username'>
                                    {'@' + user.username}
                                </span>
                            )}
                        </div>
                        <Timestamp
                            value={request.create_at}
                            className='channel-members-rhs__pending-request-time'
                            units={['now', 'second', 'minute', 'hour', 'today-yesterday', 'day', 'week', 'month', 'year']}
                            useDate={false}
                            useTime={false}
                        />
                    </div>
                </ProfilePopover>
                {actionError && (
                    <div
                        className='channel-members-rhs__pending-request-error'
                        role='alert'
                    >
                        {actionError}
                    </div>
                )}
                <div className='channel-members-rhs__pending-request-actions'>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        size='sm'
                        onClick={handleDenyClick}
                        disabled={approving || denying}
                        aria-label={formatMessage({
                            id: 'channel_join_request.deny',
                            defaultMessage: 'Deny',
                        })}
                    >
                        <FormattedMessage
                            id='channel_join_request.deny'
                            defaultMessage='Deny'
                        />
                    </Button>
                    <Button
                        type='button'
                        emphasis='primary'
                        size='sm'
                        onClick={handleApprove}
                        disabled={approving || denying}
                        aria-label={formatMessage({
                            id: 'channel_join_request.approve',
                            defaultMessage: 'Approve',
                        })}
                    >
                        <FormattedMessage
                            id='channel_join_request.approve'
                            defaultMessage='Approve'
                        />
                    </Button>
                </div>
            </div>
            <ConfirmModal
                show={showDenyConfirm}
                title={
                    <FormattedMessage
                        id='channel_join_request.deny_confirm.title'
                        defaultMessage='Deny join request'
                    />
                }
                message={
                    <FormattedMessage
                        id='channel_join_request.deny_confirm.message'
                        defaultMessage="{requester} won't be added to {channel}. They can send another request anytime."
                        values={{
                            requester: <strong>{displayName}</strong>,
                            channel: <strong>{channelDisplayName}</strong>,
                        }}
                    />
                }
                confirmButtonText={
                    <FormattedMessage
                        id='channel_join_request.deny_confirm.confirm'
                        defaultMessage='Deny request'
                    />
                }
                confirmButtonVariant='destructive'
                onConfirm={handleDenyConfirm}
                onCancel={() => setShowDenyConfirm(false)}
            />
        </>
    );
}

export default function PendingJoinRequests({
    channelId,
    requests,
}: Props) {
    const dispatch = useDispatch();
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);
    const userIds = useMemo(() => requests.map((request) => request.user_id), [requests]);
    const users = useSelector((state: GlobalState) => {
        const profiles: Record<string, UserProfile | undefined> = {};
        for (const userId of userIds) {
            profiles[userId] = getUser(state, userId);
        }
        return profiles;
    }, shallowEqual);

    const missingUserIds = useMemo(
        () => userIds.filter((userId) => !users[userId]),
        [userIds, users],
    );

    useEffect(() => {
        if (missingUserIds.length > 0) {
            dispatch(getProfilesByIds(missingUserIds));
        }
    }, [channelId, dispatch, missingUserIds]);

    if (requests.length === 0) {
        return null;
    }

    return (
        <div
            className='channel-members-rhs__pending-requests'
            data-testid='pending-join-requests-section'
        >
            <div className='channel-members-rhs__member-list-separator channel-members-rhs__member-list-separator--first'>
                <FormattedMessage
                    id='channel_join_request.pending_section.title'
                    defaultMessage='Pending join requests ({count})'
                    values={{count: requests.length}}
                />
            </div>
            {requests.map((request) => {
                const user = users[request.user_id];
                const displayName = user ? displayUsername(user, teammateNameDisplay) : request.user_id;
                return (
                    <PendingJoinRequestRow
                        key={request.id}
                        channelId={channelId}
                        request={request}
                        user={user}
                        displayName={displayName}
                    />
                );
            })}
        </div>
    );
}
