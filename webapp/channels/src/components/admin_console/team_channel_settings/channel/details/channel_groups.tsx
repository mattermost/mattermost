// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ToggleModalButton from 'components/toggle_modal_button';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {ModalIdentifiers} from 'utils/constants';
import {t} from 'utils/i18n';

import GroupList from '../../group';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';

interface ChannelGroupsProps {
    synced: boolean;
    channel: Partial<Channel>;
    onAddCallback: (groupIDs: string[]) => void;
    totalGroups: number;
    groups: Array<Partial<Group>>;
    removedGroups: Array<{[key: string]: any}>;
    onGroupRemoved: (gid: string) => void;
    setNewGroupRole: (gid: string) => void;
    isDisabled?: boolean;
}

export const ChannelGroups: React.FunctionComponent<ChannelGroupsProps> = (props: ChannelGroupsProps): JSX.Element => {
    const {onGroupRemoved, onAddCallback, totalGroups, groups, removedGroups, channel, synced, setNewGroupRole, isDisabled} = props;
    return (
        <AdminPanel
            id='channel_groups'
            titleId={synced ? t('admin.channel_settings.channel_detail.syncedGroupsTitle') : t('admin.channel_settings.channel_detail.groupsTitle')}
            titleDefault={synced ? 'Synced Groups' : 'Groups'}
            subtitleId={synced ? t('admin.channel_settings.channel_detail.syncedGroupsDescription') : t('admin.channel_settings.channel_detail.groupsDescription')}
            subtitleDefault={synced ? 'Add and remove channel members based on their group membership.' : 'Select groups to be added to this channel.'}
            button={
                <ToggleModalButton
                    id='addGroupsToChannelToggle'
                    className='btn btn-primary'
                    modalId={ModalIdentifiers.ADD_GROUPS_TO_CHANNEL}
                    dialogType={AddGroupsToChannelModal}
                    dialogProps={{
                        channel,
                        onAddCallback,
                        skipCommit: true,
                        includeGroups: removedGroups,
                        excludeGroups: groups,
                    }}
                    disabled={isDisabled}
                >
                    <FormattedMessage
                        id='admin.channel_settings.channel_details.add_group'
                        defaultMessage='Add Group'
                    />
                </ToggleModalButton>
            }
        >
            {channel.id && (
                <GroupList
                    channel={channel}
                    groups={groups}
                    totalGroups={totalGroups}
                    onGroupRemoved={onGroupRemoved}
                    setNewGroupRole={setNewGroupRole}
                    isModeSync={synced}
                    type='channel'
                    isDisabled={isDisabled}
                />
            )}
        </AdminPanel>
    );
};
