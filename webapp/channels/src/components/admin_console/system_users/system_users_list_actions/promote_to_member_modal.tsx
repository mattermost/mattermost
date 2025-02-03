// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {promoteGuestToUser} from 'mattermost-redux/actions/users';

import ConfirmModalRedux from 'components/confirm_modal_redux';

type Props = {
    user: UserProfile;
    onSuccess: () => void;
    onExited: () => void;
    onError: (error: ServerError) => void;
}

export default function PromoteToMemberModal({user, onExited, onSuccess, onError}: Props) {
    const dispatch = useDispatch();

    async function confirm() {
        const {error} = await dispatch(promoteGuestToUser(user.id));
        if (error) {
            onError(error);
        } else {
            onSuccess();
        }
    }

    const title = (
        <FormattedMessage
            id='promote_to_user_modal.title'
            defaultMessage='Promote guest {username} to member'
            values={{
                username: user.username,
            }}
        />
    );

    const message = (
        <FormattedMessage
            id='promote_to_user_modal.desc'
            defaultMessage='This action promotes the guest {username} to a member. It will allow the user to join public channels and interact with users outside of the channels they are currently members of. Are you sure you want to promote guest {username} to member?'
            values={{
                username: user.username,
            }}
        />
    );

    const promoteUserButton = (
        <FormattedMessage
            id='promote_to_user_modal.promote'
            defaultMessage='Promote'
        />
    );

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonClass='btn btn-danger'
            confirmButtonText={promoteUserButton}
            onConfirm={confirm}
            onExited={onExited}
        />
    );
}
