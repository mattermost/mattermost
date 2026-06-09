// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ChannelType} from '@mattermost/types/channels';

import ExternalLink from 'components/external_link';
import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';

import {Constants} from 'utils/constants';

type Props = {
    isPublic: boolean;
    isGroupConstrained?: boolean;
    policyEnforced?: boolean;
    onChange: (isPublic: boolean) => void;
};

const OpenInvite = ({isPublic, isGroupConstrained, policyEnforced, onChange}: Props) => {
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

    const policyNotice = policyEnforced ? (
        <p className='TeamAccessTab__policyEnforcedNotice'>
            <FormattedMessage
                id='team_settings.discoverability.policy_enforced_notice'
                defaultMessage="This team's membership is managed by a policy. Open access settings do not apply while a policy is active."
            />
        </p>
    ) : null;

    const handleChange = (selected: ChannelType) => {
        onChange(selected === Constants.OPEN_CHANNEL);
    };

    const selectorContent = (
        <div className='TeamAccessTab__discoverabilitySelector'>
            <PublicPrivateSelector
                selected={isPublic ? Constants.OPEN_CHANNEL as ChannelType : Constants.PRIVATE_CHANNEL as ChannelType}
                publicButtonProps={{
                    title: formatMessage({
                        id: 'team_settings.discoverability.public_title',
                        defaultMessage: 'Public Team',
                    }),
                    description: formatMessage({
                        id: 'team_settings.discoverability.public_description',
                        defaultMessage: 'Anyone on the server can find and join',
                    }),
                    disabled: policyEnforced,
                    tooltip: policyEnforced ? formatMessage({
                        id: 'team_settings.discoverability.policy_enforced_tooltip',
                        defaultMessage: 'Membership is managed by a policy',
                    }) : undefined,
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
                    disabled: policyEnforced,
                    tooltip: policyEnforced ? formatMessage({
                        id: 'team_settings.discoverability.policy_enforced_tooltip',
                        defaultMessage: 'Membership is managed by a policy',
                    }) : undefined,
                }}
                onChange={handleChange}
            />
            {policyNotice}
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
