// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import ExternalLink from 'components/external_link';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import LineSwitch from '../../line_switch';

type Props = {
    syncChecked: boolean;
    allAllowedChecked: boolean;
    allowedDomainsChecked: boolean;
    allowedDomains: string;
    onToggle: (syncChecked: boolean, allAllowedChecked: boolean, allowedDomainsChecked: boolean, allowedDomains: string) => void;
    isDisabled?: boolean;
};

const SyncGroupsToggle = ({syncChecked, allAllowedChecked, allowedDomainsChecked, allowedDomains, onToggle, isDisabled}: Props) => (
    <LineSwitch
        id='syncGroupSwitch'
        disabled={isDisabled}
        toggled={syncChecked}
        last={syncChecked}
        onToggle={() => onToggle(!syncChecked, allAllowedChecked, allowedDomainsChecked, allowedDomains)}
        title={(
            <FormattedMessage
                id='admin.team_settings.team_details.syncGroupMembers'
                defaultMessage='Sync Group Members'
            />
        )}
        subTitle={(
            <FormattedMessage
                id='admin.team_settings.team_details.syncGroupMembersDescr'
                defaultMessage='When enabled, adding and removing users from groups will add or remove them from this team. The only way of inviting members to this team is by adding the groups they belong to. <link>Learn More</link>'
                values={{
                    link: (msg) => (
                        <ExternalLink
                            href='https://www.mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
                            location='team_modes'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                }}
            />
        )}
    />);

const AllowAllToggle = ({syncChecked, allAllowedChecked, allowedDomainsChecked, allowedDomains, onToggle, isDisabled}: Props) =>
    (syncChecked ? null : (
        <LineSwitch
            id='allowAllToggleSwitch'
            disabled={isDisabled}
            toggled={allAllowedChecked}
            singleLine={true}
            onToggle={() => onToggle(syncChecked, !allAllowedChecked, allowedDomainsChecked, allowedDomains)}
            title={(
                <FormattedMessage
                    id='admin.team_settings.team_details.anyoneCanJoin'
                    defaultMessage='Anyone can join this team'
                />
            )}
            subTitle={(
                <FormattedMessage
                    id='admin.team_settings.team_details.anyoneCanJoinDescr'
                    defaultMessage='This team can be discovered allowing anyone with an account to join this team.'
                />
            )}
        />));

const AllowedDomainsToggle = ({syncChecked, allAllowedChecked, allowedDomainsChecked, allowedDomains, onToggle, isDisabled, last = true}: Props & {last?: boolean}) =>
    (syncChecked ? null : (
        <LineSwitch
            id='allowedDomainsToggleSwitch'
            disabled={isDisabled}
            toggled={allowedDomainsChecked}
            last={last}
            onToggle={() => onToggle(syncChecked, allAllowedChecked, !allowedDomainsChecked, allowedDomains)}
            singleLine={true}
            title={(
                <FormattedMessage
                    id='admin.team_settings.team_details.specificDomains'
                    defaultMessage='Only specific email domains can join this team'
                />
            )}
            subTitle={(
                <FormattedMessage
                    id='admin.team_settings.team_details.specificDomainsDescr'
                    defaultMessage='Users can only join the team if their email matches one of the specified domains'
                />
            )}
        >
            <>
                <div className='help-text csvDomains'>
                    <FormattedMessage
                        id='admin.team_settings.team_details.csvDomains'
                        defaultMessage='Comma Separated Email Domain List'
                    />
                </div>
                <input
                    type='text'
                    value={allowedDomains}
                    placeholder='mattermost.com'
                    className='form-control'
                    onChange={(e) => onToggle(syncChecked, allAllowedChecked, allowedDomainsChecked, e.currentTarget.value)}
                    disabled={isDisabled}
                />
            </>
        </LineSwitch>));

type PolicyEnforceToggleProps = {
    syncChecked: boolean;
    policyEnforced: boolean;

    // Locked once a policy is linked; removal happens from the policy list.
    policyEnforcedToggleAvailable: boolean;
    onToggle?: (policyEnforced: boolean) => void;
    isDisabled?: boolean;
};

const PolicyEnforceToggle = ({syncChecked, policyEnforced, policyEnforcedToggleAvailable, onToggle, isDisabled}: PolicyEnforceToggleProps) => (
    <LineSwitch
        id='policy-enforce-toggle'
        disabled={isDisabled || syncChecked || !policyEnforcedToggleAvailable}
        toggled={policyEnforced}

        // The email-domains row renders after this one unless group sync hides it,
        // in which case this is the last row.
        last={syncChecked}
        onToggle={() => {
            if (syncChecked || !policyEnforcedToggleAvailable) {
                return;
            }
            onToggle?.(!policyEnforced);
        }}
        title={(
            <FormattedMessage
                id='admin.team_settings.team_details.policy_enforced_title'
                defaultMessage='Manage membership with attribute based membership policies'
            />
        )}
        subTitle={syncChecked ? (
            <FormattedMessage
                id='admin.team_settings.team_details.policy_enforced_group_synced'
                defaultMessage='Group synced teams cannot use a membership policy. Disable group sync to manage access by attributes.'
            />
        ) : (
            <FormattedMessage
                id='admin.team_settings.team_details.policy_enforced_description'
                defaultMessage='Restrict which users can be added to this team based on their user attributes and values. Only people who match the specified conditions will be allowed to be selected and added to this team.'
            />
        )}
    />);

type TeamModesProps = Props & {
    isLicensedForLDAPGroups?: boolean;
    abacSupported?: boolean;
    policyEnforced?: boolean;
    policyEnforcedToggleAvailable?: boolean;
    onPolicyEnforcedToggle?: (policyEnforced: boolean) => void;
};

export const TeamModes = ({allAllowedChecked, syncChecked, allowedDomains, allowedDomainsChecked, onToggle, isDisabled, isLicensedForLDAPGroups, abacSupported, policyEnforced, policyEnforcedToggleAvailable, onPolicyEnforcedToggle}: TeamModesProps) => (
    <AdminPanel
        id='team_manage'
        title={defineMessage({id: 'admin.team_settings.team_detail.manageTitle', defaultMessage: 'Team Management'})}
        subtitle={defineMessage({id: 'admin.team_settings.team_detail.manageDescription', defaultMessage: 'Choose between inviting members manually or syncing members automatically from groups.'})}
    >
        <div className='group-teams-and-channels'>
            <div className='group-teams-and-channels--body'>
                {isLicensedForLDAPGroups && !policyEnforced &&
                    <SyncGroupsToggle
                        allAllowedChecked={allAllowedChecked}
                        allowedDomainsChecked={allowedDomainsChecked}
                        allowedDomains={allowedDomains}
                        syncChecked={syncChecked}
                        onToggle={onToggle}
                        isDisabled={isDisabled}
                    />
                }
                <AllowAllToggle
                    allAllowedChecked={allAllowedChecked}
                    allowedDomainsChecked={allowedDomainsChecked}
                    allowedDomains={allowedDomains}
                    syncChecked={syncChecked}
                    onToggle={onToggle}
                    isDisabled={isDisabled}
                />
                {abacSupported &&
                    <PolicyEnforceToggle
                        syncChecked={syncChecked}
                        policyEnforced={Boolean(policyEnforced)}
                        policyEnforcedToggleAvailable={Boolean(policyEnforcedToggleAvailable)}
                        onToggle={onPolicyEnforcedToggle}
                        isDisabled={isDisabled}
                    />
                }
                <AllowedDomainsToggle
                    allAllowedChecked={allAllowedChecked}
                    allowedDomainsChecked={allowedDomainsChecked}
                    allowedDomains={allowedDomains}
                    syncChecked={syncChecked}
                    onToggle={onToggle}
                    isDisabled={isDisabled}
                />
            </div>
        </div>
    </AdminPanel>);
