// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {demoteUserToGuest} from 'mattermost-redux/actions/users';

import ConfirmModalRedux from 'components/confirm_modal_redux';

type Props = {
    user: UserProfile;
    onExited: () => void;
    onSuccess: () => void;
    onError: (error: ServerError) => void;
}

export default function DemoteToGuestModal({user, onExited, onSuccess, onError}: Props) {
    const dispatch = useDispatch();

    async function confirm() {
        const {error} = await dispatch(demoteUserToGuest(user.id));
        if (error) {
            onError(error);
        } else {
            onSuccess();
        }
    }

    const title = (
        <FormattedMessage
            id='demote_to_user_modal.title'
            defaultMessage='Demote User {username} to Guest'
            values={{
                username: user.username,
            }}
        />
    );

    const message = (
        <FormattedMessage
            id='demote_to_user_modal.desc'
            defaultMessage={'This action demotes the user {username} to a guest. It will restrict the user\'s ability to join public channels and interact with users outside of the channels they are currently members of. Are you sure you want to demote user {username} to guest?'}
            values={{
                username: user.username,
            }}
        />
    );

    const demoteGuestButton = (
        <FormattedMessage
            id='demote_to_user_modal.demote'
            defaultMessage='Demote'
        />
    );

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonClass='btn btn-danger'
            confirmButtonText={demoteGuestButton}
            onConfirm={confirm}
            onExited={onExited}
        />
    );
}
