// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import ConfirmModalRedux from 'components/confirm_modal_redux';

import {getDisplayName} from 'utils/utils';

type Props = {
    user: UserProfile;
    onConfirm: () => void;
    onExited: () => void;
}

export default function ConfirmManageUserSettingsModal(props: Props) {
    const title = (
        <FormattedMessage
            id='userSettings.adminMode.modal_header'
            defaultMessage="Manage {userDisplayName}'s Settings"
            values={{userDisplayName: getDisplayName(props.user)}}
        />
    );

    const message = (
        <FormattedMessage
            id='admin.user_item.manageSettings.confirm_dialog.body'
            defaultMessage="You are about to access {userDisplayName}'s account settings. Any modifications you make will take effect immediately in their account. {userDisplayName} retains the ability to view and modify these settings at any time.<br></br><br></br> Are you sure you want to proceed with managing {userDisplayName}'s settings?"
            values={{
                userDisplayName: getDisplayName(props.user),
                br: (x: React.ReactNode) => (<><br/>{x}</>),
            }}
        />
    );

    const confirmButtonText = (
        <FormattedMessage
            id='admin.user_item.manageSettings'
            defaultMessage='Manage User Settings'
        />
    );

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonText={confirmButtonText}
            onConfirm={props.onConfirm}
            onExited={props.onExited}
        />
    );
}
