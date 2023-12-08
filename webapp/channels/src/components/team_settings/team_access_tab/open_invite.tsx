// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';

type Props = {
    allowOpenInvite: boolean;
    isGroupConstrained?: boolean;
    setAllowOpenInvite: (value: boolean) => void;
};

const OpenInvite = ({isGroupConstrained, allowOpenInvite, setAllowOpenInvite}: Props) => {
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
