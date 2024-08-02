// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {revokeAllSessionsForUser} from 'mattermost-redux/actions/users';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import ConfirmModalRedux from 'components/confirm_modal_redux';

type Props = {
    user: UserProfile;
    currentUser: UserProfile;
    onExited: () => void;
    onError: (error: ServerError) => void;
}

export default function RevokeSessionsModal({user, currentUser, onExited, onError}: Props) {
    const dispatch = useDispatch();

    async function confirm() {
        const {data, error} = await dispatch(revokeAllSessionsForUser(user.id));
        if (data && user.id === currentUser.id) {
            emitUserLoggedOutEvent();
        } else if (error) {
            onError(error);
        }
    }

    const title = (
        <FormattedMessage
            id='revoke_user_sessions_modal.title'
            defaultMessage='Revoke Sessions for {username}'
            values={{
                username: user.username,
            }}
        />
    );

    const message = (
        <FormattedMessage
            id='revoke_user_sessions_modal.desc'
            defaultMessage='This action revokes all sessions for {username}. They will be logged out from all devices. Are you sure you want to revoke all sessions for {username}?'
            values={{
                username: user.username,
            }}
        />
    );

    const revokeUserButtonButton = (
        <FormattedMessage
            id='revoke_user_sessions_modal.revoke'
            defaultMessage='Revoke'
        />
    );

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonClass='btn btn-danger'
            confirmButtonText={revokeUserButtonButton}
            onConfirm={confirm}
            onExited={onExited}
        />
    );
}
