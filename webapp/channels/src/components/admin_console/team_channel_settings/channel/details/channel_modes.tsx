// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {t} from 'utils/i18n';

import LineSwitch from '../../line_switch';

interface Props {
    isPublic: boolean;
    isSynced: boolean;
    isDefault: boolean;
    onToggle: (isSynced: boolean, isPublic: boolean) => void;
    isDisabled?: boolean;
    groupsSupported?: boolean;
}

const SyncGroupsToggle: React.SFC<Props> = (props: Props): JSX.Element => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled} = props;
    return (
        <LineSwitch
            id='syncGroupSwitch'
            disabled={isDisabled || isDefault}
            toggled={isSynced}
            last={isSynced}
            onToggle={() => {
                if (isDefault) {
                    return;
                }
                onToggle(!isSynced, isPublic);
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
    const {isPublic, isSynced, isDefault, onToggle, isDisabled} = props;
    if (isSynced) {
        return null;
    }
    return (
        <LineSwitch
            id='allow-all-toggle'
            disabled={isDisabled || isDefault}
            toggled={isPublic}
            last={true}
            onToggle={() => {
                if (isDefault) {
                    return;
                }
                onToggle(isSynced, !isPublic);
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
                    defaultMessage='If `public` the channel is discoverable and any user can join, or if `private` invitations are required. Toggle to convert public channels to private. When Group Sync is enabled, private channels cannot be converted to public.'
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

export const ChannelModes: React.SFC<Props> = (props: Props): JSX.Element => {
    const {isPublic, isSynced, isDefault, onToggle, isDisabled, groupsSupported} = props;
    return (
        <AdminPanel
            id='channel_manage'
            titleId={t('admin.channel_settings.channel_detail.manageTitle')}
            titleDefault='Channel Management'
            subtitleId={t('admin.channel_settings.channel_detail.manageDescription')}
            subtitleDefault='Choose between inviting members manually or syncing members automatically from groups.'
        >
            <div className='group-teams-and-channels'>
                <div className='group-teams-and-channels--body'>
                    {groupsSupported &&
                        <SyncGroupsToggle
                            isPublic={isPublic}
                            isSynced={isSynced}
                            isDefault={isDefault}
                            onToggle={onToggle}
                            isDisabled={isDisabled}
                        /> }
                    <AllowAllToggle
                        isPublic={isPublic}
                        isSynced={isSynced}
                        isDefault={isDefault}
                        onToggle={onToggle}
                        isDisabled={isDisabled}
                    />
                </div>
            </div>
        </AdminPanel>
    );
};
