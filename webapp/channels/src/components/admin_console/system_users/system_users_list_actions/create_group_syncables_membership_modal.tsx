// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {createGroupTeamsAndChannels} from 'mattermost-redux/actions/groups';

import ConfirmModalRedux from 'components/confirm_modal_redux';

type Props = {
    user: UserProfile;
    onExited: () => void;
    onError: (error: ServerError) => void;
}

export default function CreateGroupSyncablesMembershipsModal({user, onExited, onError}: Props) {
    const dispatch = useDispatch();

    async function confirm() {
        const {error} = await dispatch(createGroupTeamsAndChannels(user.id));
        if (error) {
            onError(error);
        }
    }

    const title = (
        <FormattedMessage
            id='create_group_memberships_modal.title'
            defaultMessage='Re-add {username} to teams and channels'
            values={{
                username: user.username,
            }}
        />
    );

    const message = (
        <FormattedMessage
            id='create_group_memberships_modal.desc'
            defaultMessage="You're about to add or re-add {username} to teams and channels based on their LDAP group membership. You can revert this change at any time."
            values={{
                username: user.username,
            }}
        />
    );

    const createGroupMembershipsButton = (
        <FormattedMessage
            id='create_group_memberships_modal.create'
            defaultMessage='Yes'
        />
    );

    const cancelGroupMembershipsButton = (
        <FormattedMessage
            id='create_group_memberships_modal.cancel'
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
