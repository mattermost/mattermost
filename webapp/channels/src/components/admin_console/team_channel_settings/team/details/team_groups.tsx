// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';

import AddGroupsToTeamModal from 'components/add_groups_to_team_modal';
import ToggleModalButton from 'components/toggle_modal_button';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {ModalIdentifiers} from 'utils/constants';

import GroupList from '../../group';

type Props = {
    onGroupRemoved: (groupId: string) => void;
    syncChecked: boolean;
    team: Team;
    onAddCallback: (groupIds: string[]) => void;
    totalGroups: number;
    groups: Group[];
    removedGroups: Group[];
    setNewGroupRole: (groupId: string) => void;
    isDisabled?: boolean;
};

export const TeamGroups = ({onGroupRemoved, syncChecked, team, onAddCallback, totalGroups, groups, removedGroups, setNewGroupRole, isDisabled}: Props) => (
    <AdminPanel
        id='team_groups'
        title={
            syncChecked ? defineMessage({id: 'admin.team_settings.team_detail.syncedGroupsTitle', defaultMessage: 'Synced Groups'}) : defineMessage({id: 'admin.team_settings.team_detail.groupsTitle', defaultMessage: 'Groups'})
        }
        subtitle={
            syncChecked ? defineMessage({id: 'admin.team_settings.team_detail.syncedGroupsDescription', defaultMessage: 'Add and remove team members based on their group membership.'}) : defineMessage({id: 'admin.team_settings.team_detail.groupsDescription', defaultMessage: 'Group members will be added to the team.'})
        }
        button={
            <ToggleModalButton
                id='addGroupsToTeamToggle'
                className='btn btn-primary'
                modalId={ModalIdentifiers.ADD_GROUPS_TO_TEAM}
                dialogType={AddGroupsToTeamModal}
                dialogProps={{
                    team,
                    onAddCallback,
                    skipCommit: true,
                    excludeGroups: groups,
                    includeGroups: removedGroups,
                }}
                disabled={isDisabled}
            >
                <FormattedMessage
                    id='admin.team_settings.team_details.add_group'
                    defaultMessage='Add Group'
                />
            </ToggleModalButton>
        }
    >
        <GroupList
            team={team}
            isModeSync={syncChecked}
            groups={groups}
            totalGroups={totalGroups}
            onGroupRemoved={onGroupRemoved}
            setNewGroupRole={setNewGroupRole}
            type='team'
            isDisabled={isDisabled}
        />
    </AdminPanel>);
