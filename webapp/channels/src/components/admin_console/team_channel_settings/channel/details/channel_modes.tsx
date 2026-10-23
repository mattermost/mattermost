// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';

import ExternalLink from 'components/external_link';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import AdminSettingsSegmentedRow from '../../admin_settings_segmented_row';
import AdminSettingsSwitch from '../../admin_settings_switch';

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

const SyncGroupsToggle = (props: Props): JSX.Element => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, policyEnforced} = props;
    return (
        <AdminSettingsSwitch
            id='syncGroupSwitch'
            disabled={isDisabled || isDefault || policyEnforced}
            checked={isSynced}
            last={isSynced}
            onChange={() => {
                if (isDefault) {
                    return;
                }
                onToggle(!isSynced, isPublic, policyEnforced);
            }}
            secondaryLabel={(
                <FormattedMessage
                    id='admin.channel_settings.channel_details.syncGroupMembersDescr'
                    defaultMessage='When enabled, adding and removing users from groups will add or remove them from this channel. The only way of inviting members to this channel is by adding the groups they belong to. <link>Learn More</link>'
                    values={{
                        link: (msg: React.ReactNode) => (
                            <ExternalLink
                                href='https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
                                location='channel_modes'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            )}
        >
            <FormattedMessage
                id='admin.channel_settings.channel_details.syncGroupMembers'
                defaultMessage='Sync Group Members'
            />
        </AdminSettingsSwitch>
    );
};

const AllowAllToggle = (props: Props): JSX.Element | null => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, policyEnforced} = props;
    const {formatMessage} = useIntl();
    if (isSynced) {
        return null;
    }

    // Mutual exclusive modes — temporary segmented control until Compass has one.
    const disabled = isDisabled || isDefault || policyEnforced;
    const setPublic = (nextPublic: boolean) => {
        if (isDefault || nextPublic === isPublic) {
            return;
        }
        onToggle(isSynced, nextPublic, policyEnforced);
    };

    return (
        <AdminSettingsSegmentedRow
            id='allow-all-toggle'
            disabled={disabled}
            last={false}
            groupAriaLabel={formatMessage({
                id: 'admin.channel_settings.channel_details.isPublic',
                defaultMessage: 'Public channel or private channel',
            })}
            secondaryLabel={isDefault ? (
                <FormattedMessage
                    id='admin.channel_settings.channel_details.isDefaultDescr'
                    defaultMessage='This default channel cannot be converted into a private channel.'
                />
            ) : (
                <FormattedMessage
                    id='admin.channel_settings.channel_details.isPublicDescr'
                    defaultMessage='Select Public for a channel any user can find and join. {br}Select Private to require channel invitations to join. {br}Use this control to change this channel from public to private or from private to public.'
                    values={{br: (<br/>)}}
                />
            )}
            segments={[
                {
                    id: 'public',
                    testId: 'allow-all-toggle-public',
                    selected: isPublic,
                    onSelect: () => setPublic(true),
                    label: (
                        <FormattedMessage
                            id='channel_toggle_button.public'
                            defaultMessage='Public'
                        />
                    ),
                },
                {
                    id: 'private',
                    testId: 'allow-all-toggle-private',
                    selected: !isPublic,
                    onSelect: () => setPublic(false),
                    label: (
                        <FormattedMessage
                            id='channel_toggle_button.private'
                            defaultMessage='Private'
                        />
                    ),
                },
            ]}
        >
            <FormattedMessage
                id='admin.channel_settings.channel_details.isPublic'
                defaultMessage='Public channel or private channel'
            />
        </AdminSettingsSegmentedRow>
    );
};

const PolicyEnforceToggle = (props: Props): JSX.Element | null => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, policyEnforced, policyEnforcedToggleAvailable} = props;
    if (isSynced) {
        return null;
    }

    let secondaryLabel: JSX.Element;
    if (isDefault) {
        secondaryLabel = (
            <FormattedMessage
                id='admin.channel_settings.channel_details.default_channel_not_supported'
                defaultMessage='The default channel cannot have a membership policy.'
            />
        );
    } else if (isPublic) {
        secondaryLabel = (
            <FormattedMessage
                id='admin.channel_settings.channel_details.attribute_based_description_public'
                defaultMessage='Recommend this channel to users whose attributes match the rules and (optionally) auto-add them. Anyone can still join freely.'
            />
        );
    } else {
        secondaryLabel = (
            <FormattedMessage
                id='admin.channel_settings.channel_details.attribute_based_description'
                defaultMessage='Restrict which users can be invited to this channel based on their user attributes and values. Only people who match the specified conditions will be allowed to be selected and added to this channel.'
            />
        );
    }

    return (
        <AdminSettingsSwitch
            id='policy-enforce-toggle'

            // Keep the visual disabled state aligned with the click guard in
            // onChange (which short-circuits when isDefault is true). Without
            // including isDefault here the toggle would look enabled but do
            // nothing on the default channel.
            disabled={isDisabled || isSynced || isDefault || !policyEnforcedToggleAvailable}
            checked={policyEnforced}
            last={true}
            onChange={() => {
                if (isDefault || !policyEnforcedToggleAvailable) {
                    return;
                }
                onToggle(isSynced, isPublic, !policyEnforced);
            }}
            secondaryLabel={secondaryLabel}
        >
            <FormattedMessage
                id='admin.channel_settings.channel_details.policy_enforced_title'
                defaultMessage='Enable attribute based channel access'
            />
        </AdminSettingsSwitch>
    );
};

export const ChannelModes = (props: Props): JSX.Element => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, groupsSupported, policyEnforced, policyEnforcedToggleAvailable, abacSupported} = props;
    return (
        <AdminPanel
            id='channel_manage'
            title={defineMessage({id: 'admin.channel_settings.channel_detail.manageTitle', defaultMessage: 'Channel Management'})}
            subtitle={defineMessage({id: 'admin.channel_settings.channel_detail.manageDescription', defaultMessage: 'Choose between inviting members manually or syncing members automatically from groups.'})}
        >
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
        </AdminPanel>
    );
};
