// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import ExternalLink from 'components/external_link';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';

import type {Team} from '@mattermost/types/teams';
import type {ActionResult} from 'mattermost-redux/types/actions';

type Props = {
    teamId?: string;
    isActive: boolean;
    isGroupConstrained?: boolean;
    allowOpenInvite?: boolean;
    onToggle: (active: boolean) => void;
    patchTeam: (patch: Partial<Team>) => Promise<ActionResult>;
};

const OpenInvite = (props: Props) => {
    const {teamId, isActive, isGroupConstrained, onToggle, patchTeam} = props;
    const intl = useIntl();
    const [serverError, setServerError] = useState('');
    const [allowOpenInvite, setAllowOpenInvite] = useState(props.allowOpenInvite);

    const submit = useCallback(() => {
        setServerError('');
        const data = {
            id: teamId,
            allow_open_invite: allowOpenInvite,
        };

        patchTeam(data).then(({error}) => {
            if (error) {
                setServerError(error.message);
            } else {
                onToggle(false);
            }
        });
    }, [onToggle, patchTeam, teamId, allowOpenInvite]);

    const handleToggle = useCallback(() => {
        if (isActive) {
            onToggle(false);
        } else {
            onToggle(true);
            setAllowOpenInvite(props.allowOpenInvite);
        }
    }, [isActive, onToggle]);

    if (!isActive) {
        let describe = '';
        if (props.allowOpenInvite) {
            describe = intl.formatMessage({id: 'general_tab.yes', defaultMessage: 'Yes'});
        } else if (isGroupConstrained) {
            describe = intl.formatMessage({id: 'team_settings.openInviteSetting.groupConstrained', defaultMessage: 'No, members of this team are added and removed by linked groups.'});
        } else {
            describe = intl.formatMessage({id: 'general_tab.no', defaultMessage: 'No'});
        }

        return (
            <SettingItemMin
                title={intl.formatMessage({id: 'general_tab.openInviteTitle', defaultMessage: 'Allow any user with an account on this server to join this team'})}
                describe={describe}
                updateSection={handleToggle}
                section={'open_invite'}
            />
        );
    }

    let inputs;

    if (isGroupConstrained) {
        inputs = [
            <div key='userOpenInviteOptions'>
                <div>
                    <FormattedMessage
                        id='team_settings.openInviteDescription.groupConstrained'
                        defaultMessage='No, members of this team are added and removed by linked groups. <link>Learn More</link>'
                        values={{
                            link: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
                                    location='open_invite'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                </div>
            </div>,
        ];
    } else {
        inputs = [
            <fieldset key='userOpenInviteOptions'>
                <legend className='form-legend hidden-label'>
                    <FormattedMessage
                        id='team_settings.openInviteDescription.ariaLabel'
                        defaultMessage='Invite Code'
                    />
                </legend>
                <div className='radio'>
                    <label>
                        <input
                            id='teamOpenInvite'
                            name='userOpenInviteOptions'
                            type='radio'
                            defaultChecked={allowOpenInvite}
                            onChange={() => setAllowOpenInvite(true)}
                        />
                        <FormattedMessage
                            id='general_tab.yes'
                            defaultMessage='Yes'
                        />
                    </label>
                    <br/>
                </div>
                <div className='radio'>
                    <label>
                        <input
                            id='teamOpenInviteNo'
                            name='userOpenInviteOptions'
                            type='radio'
                            defaultChecked={!allowOpenInvite}
                            onChange={() => setAllowOpenInvite(false)}
                        />
                        <FormattedMessage
                            id='general_tab.no'
                            defaultMessage='No'
                        />
                    </label>
                    <br/>
                </div>
                <div className='mt-5'>
                    <FormattedMessage
                        id='general_tab.openInviteDesc'
                        defaultMessage='When allowed, a link to this team will be included on the landing page allowing anyone with an account to join this team. Changing from "Yes" to "No" will regenerate the invitation code, create a new invitation link and invalidate the previous link.'
                    />
                </div>
            </fieldset>,
        ];
    }

    return (
        <SettingItemMax
            title={intl.formatMessage({id: 'general_tab.openInviteTitle', defaultMessage: 'Allow any user with an account on this server to join this team'})}
            inputs={inputs}
            submit={submit}
            serverError={serverError}
            updateSection={handleToggle}
        />
    );
};

export default OpenInvite;
