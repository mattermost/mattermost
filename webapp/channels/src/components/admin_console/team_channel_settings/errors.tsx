// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormError from 'components/form_error';
import ToggleModalButton from 'components/toggle_modal_button';

import {ModalIdentifiers} from 'utils/constants';

import UsersToBeRemovedModal from './users_to_be_removed_modal';

type NeedGroupsErrorProps = {
    warning?: boolean;
    isChannel?: boolean;
};

export const NeedGroupsError = ({warning, isChannel = false}: NeedGroupsErrorProps) => {
    let error = (
        <FormattedMessage
            id='admin.team_channel_settings.need_groups'
            defaultMessage='You must add at least one group to manage this team by sync group members.'
        />
    );

    if (isChannel) {
        error = (
            <FormattedMessage
                id='admin.team_channel_settings.need_groups_channel'
                defaultMessage='You must add at least one group to manage this channel by sync group members.'
            />
        );
    }

    return (
        <FormError
            iconClassName={`fa-exclamation-${warning ? 'circle' : 'triangle'}`}
            textClassName={`has-${warning ? 'warning' : 'error'}`}
            error={error}
        />
    );
};

export const NeedDomainsError = () => (
    <FormError
        error={(
            <FormattedMessage
                id='admin.team_channel_settings.need_domains'
                defaultMessage='Please specify allowed email domains.'
            />)}
    />
);

type UsersWillBeRemovedProps = {
    users: UserProfile[];
    total: number;
    scope: string;
    scopeId: string;
}

export const UsersWillBeRemovedError = ({users, total, scope, scopeId}: UsersWillBeRemovedProps) => {
    let error = (
        <FormattedMessage
            id='admin.team_channel_settings.users_will_be_removed'
            defaultMessage='{amount, number} {amount, plural, one {User} other {Users}} will be removed from this team. They are not in groups linked to this team.'
            values={{amount: total}}
        />
    );

    if (scope === 'channel') {
        error = (
            <FormattedMessage
                id='admin.team_channel_settings.channel_users_will_be_removed'
                defaultMessage='{amount, number} {amount, plural, one {User} other {Users}} will be removed from this channel. They are not in groups linked to this channel.'
                values={{amount: total}}
            />
        );
    }

    return (
        <FormError
            iconClassName='fa-exclamation-triangle'
            textClassName='has-warning'
            error={(
                <span>
                    {error}
                    <ToggleModalButton
                        className='btn btn-link'
                        modalId={ModalIdentifiers.USERS_TO_BE_REMOVED}
                        dialogType={UsersToBeRemovedModal}
                        dialogProps={{total, users, scope, scopeId}}
                    >
                        <FormattedMessage
                            id='admin.team_channel_settings.view_removed_users'
                            defaultMessage='View These Users'
                        />
                    </ToggleModalButton>
                </span>
            )}
        />

    );
};
