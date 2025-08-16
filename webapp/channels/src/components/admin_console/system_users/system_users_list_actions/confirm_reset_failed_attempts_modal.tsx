// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {resetFailedAttempts} from 'mattermost-redux/actions/users';

import ConfirmModalRedux from 'components/confirm_modal_redux';

type Props = {
    user: UserProfile;
    onError: (error: ServerError) => void;
    onSuccess: () => void;
    onExited: () => void;
}

export default function ConfirmResetFailedAttemptsModal({user, onSuccess, onError, onExited}: Props) {
    const dispatch = useDispatch();

    async function confirm() {
        const {error} = await dispatch(resetFailedAttempts(user.id));
        if (error) {
            onError(error);
        }
        onSuccess();
    }

    const title = (
        <FormattedMessage
            id='confirm_reset_failed_attempts_modal.title'
            defaultMessage='Reset failed login attempts for {username} and unlock account'
            values={{
                username: user.username,
            }}
        />
    );

    const message = (
        <FormattedMessage
            id='confirm_reset_failed_attempts_modal.desc'
            defaultMessage="You're about to reset the failed login attempts for {username} and unlock their account. Are you sure you want to continue?"
            values={{
                username: user.username,
            }}
        />
    );

    const createGroupMembershipsButton = (
        <FormattedMessage
            id='confirm_reset_failed_attempts_modal.create'
            defaultMessage='Yes'
        />
    );

    const cancelGroupMembershipsButton = (
        <FormattedMessage
            id='confirm_reset_failed_attempts_modal.cancel'
            defaultMessage='No'
        />
    );

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonClass='btn btn-danger'
            cancelButtonText={cancelGroupMembershipsButton}
            confirmButtonText={createGroupMembershipsButton}
            onConfirm={confirm}
            onExited={onExited}
        />
    );
}
