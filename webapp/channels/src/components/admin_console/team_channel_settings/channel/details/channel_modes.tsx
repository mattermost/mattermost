// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import ExternalLink from 'components/external_link';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import LineSwitch from '../../line_switch';

interface Props {
    isPublic: boolean;
    isSynced: boolean;
    isDefault: boolean;
    onToggle: (isSynced: boolean, isPublic: boolean, policyEnforced: boolean) => void;
    isDisabled?: boolean;
    groupsSupported?: boolean;
    abacSupported?: boolean;
    policyEnforced: boolean;
    policyEnforcedToggleAvailable: boolean;
}

const SyncGroupsToggle: React.SFC<Props> = (props: Props): JSX.Element => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, policyEnforced} = props;
    return (
        <LineSwitch
            id='syncGroupSwitch'
            disabled={isDisabled || isDefault || policyEnforced}
            toggled={isSynced}
            last={isSynced}
            onToggle={() => {
                if (isDefault) {
                    return;
                }
                onToggle(!isSynced, isPublic, policyEnforced);
            }}
            title={(
                <FormattedMessage
                    id='admin.channel_settings.channel_details.syncGroupMembers'
                    defaultMessage='Sync Group Members'
                />
            )}
            subTitle={(
                <FormattedMessage
                    id='admin.channel_settings.channel_details.syncGroupMembersDescr'
                    defaultMessage='When enabled, adding and removing users from groups will add or remove them from this channel. The only way of inviting members to this channel is by adding the groups they belong to. <link>Learn More</link>'
                    values={{
                        link: (msg: React.ReactNode) => (
                            <ExternalLink
                                href='https://www.mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
                                location='channel_modes'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            )}
        />
    );
};

const AllowAllToggle: React.SFC<Props> = (props: Props): JSX.Element | null => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, policyEnforced} = props;
    if (isSynced) {
        return null;
    }
    return (
        <LineSwitch
            id='allow-all-toggle'
            disabled={isDisabled || isDefault || policyEnforced}
            toggled={isPublic}
            last={false}
            onToggle={() => {
                if (isDefault) {
                    return;
                }
                onToggle(isSynced, !isPublic, policyEnforced);
            }}
            title={(
                <FormattedMessage
                    id='admin.channel_settings.channel_details.isPublic'
                    defaultMessage='Public channel or private channel'
                />
            )}
            subTitle={isDefault ? (
                <FormattedMessage
                    id='admin.channel_settings.channel_details.isDefaultDescr'
                    defaultMessage='This default channel cannot be converted into a private channel.'
                />
            ) : (
                <FormattedMessage
                    id='admin.channel_settings.channel_details.isPublicDescr'
                    defaultMessage='Select Public for a channel any user can find and join. {br}Select Private to require channel invitations to join. {br}Use this switch to change this channel from public to private or from private to public.'
                    values={{br: (<br/>)}}
                />
            )
            }
            onText={(
                <FormattedMessage
                    id='channel_toggle_button.public'
                    defaultMessage='Public'
                />
            )}
            offText={(
                <FormattedMessage
                    id='channel_toggle_button.private'
                    defaultMessage='Private'
                />
            )}
        />
    );
};

const PolicyEnforceToggle: React.SFC<Props> = (props: Props): JSX.Element | null => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, policyEnforced, policyEnforcedToggleAvailable} = props;
    if (isSynced) {
        return null;
    }
    return (
        <LineSwitch
            id='policy-enforce-toggle'
            disabled={isDisabled || isSynced || isPublic || !policyEnforcedToggleAvailable}
            toggled={policyEnforced}
            last={true}
            onToggle={() => {
                if (isDefault || !policyEnforcedToggleAvailable) {
                    return;
                }
                onToggle(isSynced, isPublic, !policyEnforced);
            }}
            title={(
                <FormattedMessage
                    id='admin.channel_settings.channel_details.policy_enforced_title'
                    defaultMessage='Enable attribute based channel access'
                />
            )}
            subTitle={isDefault || isPublic ? (
                <FormattedMessage
                    id='admin.channel_settings.channel_details.private_channel_only'
                    defaultMessage='Only private channels can be attribute based.'
                />
            ) : (
                <FormattedMessage
                    id='admin.channel_settings.channel_details.attribute_based_description'
                    defaultMessage='Restrict which users can be invited to this channel based on their user attributes and values. Only people who match the specified conditions will be allowed to be selected and added to this channel.'
                />
            )
            }
        />
    );
};

export const ChannelModes: React.SFC<Props> = (props: Props): JSX.Element => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, groupsSupported, policyEnforced, policyEnforcedToggleAvailable, abacSupported} = props;
    return (
        <AdminPanel
            id='channel_manage'
            title={defineMessage({id: 'admin.channel_settings.channel_detail.manageTitle', defaultMessage: 'Channel Management'})}
            subtitle={defineMessage({id: 'admin.channel_settings.channel_detail.manageDescription', defaultMessage: 'Choose between inviting members manually or syncing members automatically from groups.'})}
        >
            <div className='group-teams-and-channels'>
                <div className='group-teams-and-channels--body'>
                    {!policyEnforced && groupsSupported &&
                        <SyncGroupsToggle
                            isPublic={isPublic}
                            isSynced={isSynced}
                            isDefault={isDefault}
                            onToggle={onToggle}
                            isDisabled={isDisabled}
                            policyEnforced={policyEnforced}
                            policyEnforcedToggleAvailable={policyEnforcedToggleAvailable}
                        /> }
                    <AllowAllToggle
                        isPublic={isPublic}
                        isSynced={isSynced}
                        isDefault={isDefault}
                        onToggle={onToggle}
                        isDisabled={isDisabled}
                        policyEnforced={policyEnforced}
                        policyEnforcedToggleAvailable={policyEnforcedToggleAvailable}
                    />
                    {abacSupported &&
                        <PolicyEnforceToggle
                            isPublic={isPublic}
                            isSynced={isSynced}
                            isDefault={isDefault}
                            onToggle={onToggle}
                            isDisabled={isDisabled}
                            policyEnforced={policyEnforced}
                            policyEnforcedToggleAvailable={policyEnforcedToggleAvailable}
                        />
                    }
                </div>
            </div>
        </AdminPanel>
    );
};

