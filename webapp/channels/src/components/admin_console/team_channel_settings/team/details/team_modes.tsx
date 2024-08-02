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
}

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
                    link: (msg: string) => (
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

const AllowedDomainsToggle = ({syncChecked, allAllowedChecked, allowedDomainsChecked, allowedDomains, onToggle, isDisabled}: Props) =>
    (syncChecked ? null : (
        <LineSwitch
            id='allowedDomainsToggleSwitch'
            disabled={isDisabled}
            toggled={allowedDomainsChecked}
            last={true}
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

type TeamModesProps = Props & {
    isLicensedForLDAPGroups?: boolean;
};

export const TeamModes = ({allAllowedChecked, syncChecked, allowedDomains, allowedDomainsChecked, onToggle, isDisabled, isLicensedForLDAPGroups}: TeamModesProps) => (
    <AdminPanel
        id='team_manage'
        title={defineMessage({id: 'admin.team_settings.team_detail.manageTitle', defaultMessage: 'Team Management'})}
        subtitle={defineMessage({id: 'admin.team_settings.team_detail.manageDescription', defaultMessage: 'Choose between inviting members manually or syncing members automatically from groups.'})}
    >
        <div className='group-teams-and-channels'>
            <div className='group-teams-and-channels--body'>
                {isLicensedForLDAPGroups &&
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
