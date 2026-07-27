// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import ExternalLink from 'components/external_link';
import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';

import {Constants} from 'utils/constants';

type Props = {
    isPublic: boolean;
    isGroupConstrained?: boolean;
    onChange: (isPublic: boolean) => void;
};

const OpenInvite = ({isPublic, isGroupConstrained, onChange}: Props) => {
    const {formatMessage} = useIntl();

    if (isGroupConstrained) {
        const groupConstrainedContent = (
            <p id='groupConstrainedContent'>{
                formatMessage({
                    id: 'team_settings.openInviteDescription.groupConstrained',
                    defaultMessage: 'Members of this team are added and removed by linked groups. <link>Learn More</link>',
                }, {
                    link: (msg: React.ReactNode) => (
                        <ExternalLink
                            href='https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
                            location='open_invite'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                })}
            </p>
        );
        return (
            <BaseSettingItem
                className='access-invite-domains-section'
                title={formatMessage({
                    id: 'team_settings.discoverability.title',
                    defaultMessage: 'Discoverability',
                })}
                description={formatMessage({
                    id: 'general_tab.openInviteDesc',
                    defaultMessage: "When allowed, a link to this team will be included on the landing page allowing anyone with an account to join this team. Changing from 'Yes' to 'No' will regenerate the invitation code, create a new invitation link and invalidate the previous link.",
                })}
                descriptionAboveContent={true}
                content={groupConstrainedContent}
            />
        );
    }

    const handleChange = (selected: string) => {
        onChange(selected === Constants.OPEN_CHANNEL);
    };

    const selectorContent = (
        <div className='TeamAccessTab__discoverabilitySelector'>
            <PublicPrivateSelector
                selected={isPublic ? Constants.OPEN_CHANNEL : Constants.PRIVATE_CHANNEL}
                publicButtonProps={{
                    title: formatMessage({
                        id: 'team_settings.discoverability.public_title',
                        defaultMessage: 'Public Team',
                    }),
                    description: formatMessage({
                        id: 'team_settings.discoverability.public_description',
                        defaultMessage: 'Anyone on the server can find and join',
                    }),
                }}
                privateButtonProps={{
                    title: formatMessage({
                        id: 'team_settings.discoverability.private_title',
                        defaultMessage: 'Private Team',
                    }),
                    description: formatMessage({
                        id: 'team_settings.discoverability.private_description',
                        defaultMessage: 'Only invited members can join',
                    }),
                }}
                onChange={handleChange}
            />
        </div>
    );

    return (
        <BaseSettingItem
            className='access-invite-domains-section'
            title={formatMessage({
                id: 'team_settings.discoverability.title',
                defaultMessage: 'Discoverability',
            })}
            description={formatMessage({
                id: 'general_tab.openInviteDesc',
                defaultMessage: "When allowed, a link to this team will be included on the landing page allowing anyone with an account to join this team. Changing from 'Yes' to 'No' will regenerate the invitation code, create a new invitation link and invalidate the previous link.",
            })}
            descriptionAboveContent={true}
            content={selectorContent}
        />
    );
};

export default OpenInvite;
