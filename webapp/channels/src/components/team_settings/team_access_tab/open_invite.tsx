// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';

type Props = {
    teamId?: string;
    isGroupConstrained?: boolean;
    allowOpenInvite?: boolean;
    patchTeam: (patch: Partial<Team>) => Promise<ActionResult>;
};

const OpenInvite = (props: Props) => {
    const {teamId, isGroupConstrained, patchTeam} = props;
    const intl = useIntl();
    const [serverError, setServerError] = useState('');
    const [allowOpenInvite, setAllowOpenInvite] = useState<boolean>(props.allowOpenInvite ?? false);

    const submit = useCallback(() => {
        setServerError('');
        const data = {
            id: teamId,
            allow_open_invite: allowOpenInvite,
        };

        patchTeam(data).then(({error}) => {
            if (error) {
                setServerError(error.message);
            }
        });
    }, [patchTeam, teamId, allowOpenInvite]);

    if (isGroupConstrained) {
        // todo sinan: waiting info from Matt. handle with early return
        // openInviteSection = (
        // <div key='userOpenInviteOptions'>
        //     <div>
        //         <FormattedMessage
        //             id='team_settings.openInviteDescription.groupConstrained'
        //             defaultMessage='No, members of this team are added and removed by linked groups. <link>Learn More</link>'
        //             values={{
        //                 link: (msg: React.ReactNode) => (
        //                     <ExternalLink
        //                         href='https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
        //                         location='open_invite'
        //                     >
        //                         {msg}
        //                     </ExternalLink>
        //                 ),
        //             }}
        //         />
        //     </div>
        // </div>,
        // );
    }

    return (

        // <SettingItemMax
        //     title={intl.formatMessage({id: 'general_tab.openInviteTitle', defaultMessage: 'Allow any user with an account on this server to join this team'})}
        //     inputs={inputs}
        //     submit={submit}
        //     serverError={serverError}
        // />
        <CheckboxSettingItem
            className='access-invite-domains-section'
            inputFieldData={{title: {id: 'general_tab.allowedDomains', defaultMessage: 'Allow only users with a specific email domain to join this team'}, name: 'name'}}
            inputFieldValue={allowOpenInvite}
            handleChange={(e) => setAllowOpenInvite(e)}
            title={{id: 'general_tab.openInviteTitle', defaultMessage: 'Users on this server'}}
            description={{id: 'general_tab.openInviteDesc', defaultMessage: 'When enabled, a link to this team will be included on the landing page allowing anyone with an account to join this team. Changing this setting will create a new invitation link and invalidate the previous link.'}}
            descriptionAboveContent={true}
        />
    );
};

export default OpenInvite;
