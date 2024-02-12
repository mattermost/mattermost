// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {updateUserActive} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import {getExternalBotAccounts} from 'mattermost-redux/selectors/entities/bots';

import ConfirmModalRedux from 'components/confirm_modal_redux';
import ExternalLink from 'components/external_link';

import Constants from 'utils/constants';

type Props = {
    user: UserProfile;
    onExited: () => void;
    onSuccess: () => void;
    onError: (error: ServerError) => void;
}

export default function DeactivateMemberModal({user, onExited, onSuccess, onError}: Props) {
    const dispatch = useDispatch();
    const config = useSelector(getConfig);
    const bots = useSelector(getExternalBotAccounts);
    const siteURL = config.ServiceSettings?.SiteURL;

    async function deactivateMember() {
        const {error} = await dispatch(updateUserActive(user.id, false));
        if (error) {
            onError(error);
        } else {
            onSuccess();
        }
    }

    const title = (
        <FormattedMessage
            id='deactivate_member_modal.title'
            defaultMessage='Deactivate {username}'
            values={{
                username: user.username,
            }}
        />
    );

    const defaultMessage = (
        <FormattedMessage
            id='deactivate_member_modal.desc'
            defaultMessage='This action deactivates {username}. They will be logged out and not have access to any teams or channels on this system.\n'
            values={{
                username: user.username,
            }}
        />);

    let warning;
    if (user.auth_service !== '' && user.auth_service !== Constants.EMAIL_SERVICE) {
        warning = (
            <strong>
                <br/>
                <br/>
                <FormattedMessage
                    id='deactivate_member_modal.sso_warning'
                    defaultMessage='You must also deactivate this user in the SSO provider or they will be reactivated on next login or sync.'
                />
            </strong>
        );
    }

    const confirmationMessage = (
        <FormattedMessage
            id='deactivate_member_modal.desc.confirm'
            defaultMessage='Are you sure you want to deactivate {username}?'
            values={{
                username: user.username,
            }}
        />);
    let messageForUsersWithBotAccounts;
    if (config.ServiceSettings?.DisableBotsWhenOwnerIsDeactivated) {
        for (const bot of Object.values(bots)) {
            if ((bot.owner_id === user.id) && (bot.delete_at === 0)) {
                messageForUsersWithBotAccounts = (
                    <>
                        <ul>
                            <li>
                                <FormattedMessage
                                    id='deactivate_member_modal.desc.for_users_with_bot_accounts1'
                                    defaultMessage='This action deactivates {username}'
                                    values={{
                                        username: user.username,
                                    }}
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='deactivate_member_modal.desc.for_users_with_bot_accounts2'
                                    defaultMessage='They will be logged out and not have access to any teams or channels on this system.'
                                />
                            </li>
                            <li>
                                <FormattedMessage
                                    id='deactivate_member_modal.desc.for_users_with_bot_accounts3'
                                    defaultMessage='Bot accounts they manage will be disabled along with their integrations. To enable them again, go to <linkBots>Integrations > Bot Accounts</linkBots>. <linkDocumentation>Learn more about bot accounts</linkDocumentation>.'
                                    values={{
                                        siteURL,
                                        linkBots: (msg: React.ReactNode) => (
                                            <a
                                                href={`${siteURL}/_redirect/integrations/bots`}
                                            >
                                                {msg}
                                            </a>
                                        ),
                                        linkDocumentation: (msg: React.ReactNode) => (
                                            <ExternalLink
                                                href='https://mattermost.com/pl/default-bot-accounts'
                                                location='system_users_dropdown'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                    }}
                                />
                            </li>
                        </ul>
                        <p/>
                        <p/>
                    </>
                );
                break;
            }
        }
    }
    const message = (
        <div>
            {messageForUsersWithBotAccounts || defaultMessage}
            {confirmationMessage}
            {warning}
        </div>
    );

    const confirmButtonClass = 'btn btn-danger';
    const deactivateMemberButton = (
        <FormattedMessage
            id='deactivate_member_modal.deactivate'
            defaultMessage='Deactivate'
        />
    );

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonClass={confirmButtonClass}
            confirmButtonText={deactivateMemberButton}
            onConfirm={deactivateMember}
            onExited={onExited}
        />
    );
}
