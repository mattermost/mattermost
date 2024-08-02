// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';

import AddGroupsToChannelModal from 'components/add_groups_to_channel_modal';
import ToggleModalButton from 'components/toggle_modal_button';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {ModalIdentifiers} from 'utils/constants';

import GroupList from '../../group';

interface ChannelGroupsProps {
    synced: boolean;
    channel: Partial<Channel>;
    onAddCallback: (groupIDs: string[]) => void;
    totalGroups: number;
    groups: Group[];
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
            title={
                synced ?
                    defineMessage({id: 'admin.channel_settings.channel_detail.syncedGroupsTitle', defaultMessage: 'Synced Groups'}) :
                    defineMessage({id: 'admin.channel_settings.channel_detail.groupsTitle', defaultMessage: 'Groups'})}
            subtitle={
                synced ?
                    defineMessage({id: 'admin.channel_settings.channel_detail.syncedGroupsDescription', defaultMessage: 'Add and remove channel members based on their group membership.'}) :
                    defineMessage({id: 'admin.channel_settings.channel_detail.groupsDescription', defaultMessage: 'Select groups to be added to this channel.'})}
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
