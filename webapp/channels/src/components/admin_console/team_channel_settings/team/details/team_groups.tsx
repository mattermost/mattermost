// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Group} from '@mattermost/types/groups';
import {Team} from '@mattermost/types/teams';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import AddGroupsToTeamModal from 'components/add_groups_to_team_modal';
import ToggleModalButton from 'components/toggle_modal_button';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import GroupList from '../../group';
import {ModalIdentifiers} from 'utils/constants';
import {t} from 'utils/i18n';

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
        titleId={syncChecked ? t('admin.team_settings.team_detail.syncedGroupsTitle') : t('admin.team_settings.team_detail.groupsTitle')}
        titleDefault={syncChecked ? 'Synced Groups' : 'Groups'}
        subtitleId={syncChecked ? t('admin.team_settings.team_detail.syncedGroupsDescription') : t('admin.team_settings.team_detail.groupsDescription')}
        subtitleDefault={syncChecked ? 'Add and remove team members based on their group membership.' : 'Group members will be added to the team.'}
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
