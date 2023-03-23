// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';
import General from 'mattermost-redux/constants/general';
import {GlobalState} from '@mattermost/types/store';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getMyChannelMemberships, getMyCurrentChannelMembership, getUsers} from 'mattermost-redux/selectors/entities/common';
import {UserProfile} from '@mattermost/types/users';
import {sortByUsername} from 'mattermost-redux/utils/user_utils';
import {IDMappedObjects} from '@mattermost/types/utilities';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {DateTime} from 'luxon';

import {haveIChannelPermission, haveISystemPermission, haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';

import Permissions from 'mattermost-redux/constants/permissions';

import {Team} from '@mattermost/types/teams';

import {pluginId} from 'src/manifest';
import {PlaybookRunStatus, playbookRunIsActive} from 'src/types/playbook_run';
import {findLastUpdated} from 'src/utils';
import {GlobalSettings} from 'src/types/settings';
import {
    ChecklistItem,
    ChecklistItemState,
    ChecklistItemsFilter,
    ChecklistItemsFilterDefault,
} from 'src/types/playbook';
import {PlaybooksPluginState} from 'src/reducer';

// Assert known typing
const pluginState = (state: GlobalState): PlaybooksPluginState => state['plugins-' + pluginId as keyof GlobalState] as unknown as PlaybooksPluginState || {} as PlaybooksPluginState;

// Fake selector to use it as a selector that always fails to get info from store
// It's useful to be compliant with some sort of selector-based parameters
export const noopSelector = () => undefined;

export const selectToggleRHS = (state: GlobalState): () => void => pluginState(state).toggleRHSFunction;

export const isPlaybookRunRHSOpen = (state: GlobalState): boolean => pluginState(state).rhsOpen;

export const backstageRHS = {
    section: (state: GlobalState) => pluginState(state).backstageRHS.section,
    isOpen: (state: GlobalState) => pluginState(state).backstageRHS.isOpen,
    viewMode: (state: GlobalState) => pluginState(state).backstageRHS.viewMode,
};

export const getIsRhsExpanded = (state: any): boolean => state.views.rhs.isSidebarExpanded;

export const getAdminAnalytics = (state: GlobalState): Record<string, number> => state.entities.admin.analytics as Record<string, number>;

export const clientId = (state: GlobalState): string => pluginState(state).clientId;

export const globalSettings = (state: GlobalState): GlobalSettings | null => pluginState(state).globalSettings;

/**
 * @returns runs indexed by playbookRunId->playbookRun
 */
export const myPlaybookRuns = (state: GlobalState) => pluginState(state).myPlaybookRuns;

/**
 * @returns runs indexed by teamId->{channelId->playbookRun}
 */
export const myPlaybookRunsByTeam = (state: GlobalState) => pluginState(state).myPlaybookRunsByTeam;

/**
 * getRun selector to extract a run from the store
 *
 * teamId and channelId are optional, when they are passed run will be found efficiently
 */
export const getRun = (playbookRunId: string, teamId?: string, channelId?: string) => {
    return (state: GlobalState) => {
        const runsByTeam = myPlaybookRunsByTeam(state);
        if (teamId && channelId) {
            return runsByTeam[teamId]?.[channelId];
        }
        return Object.values(runsByTeam).flatMap((x) => x && Object.values(x)).find((run) => run?.id === playbookRunId);
    };
};

// @deprecated: now we should check playbookRun.participants and ignore channel members
export const canIPostUpdateForRun = (state: GlobalState, channelId: string, teamId: string) => {
    const canPost = haveIChannelPermission(state, teamId, channelId, Permissions.READ_CHANNEL);

    const canManageSystem = haveISystemPermission(state, {
        channel: channelId,
        team: teamId,
        permission: Permissions.MANAGE_SYSTEM,
    });

    return canPost || canManageSystem;
};

export const inPlaybookRunChannel = createSelector(
    'inPlaybookRunChannel',
    getCurrentTeamId,
    getCurrentChannelId,
    myPlaybookRunsByTeam,
    (teamId, channelId, playbookRunMapByTeam) => {
        return Boolean(playbookRunMapByTeam[teamId]?.[channelId]);
    },
);

export const currentPlaybookRun = createSelector(
    'currentPlaybookRun',
    getCurrentTeamId,
    getCurrentChannelId,
    myPlaybookRunsByTeam,
    (teamId, channelId, playbookRunMapByTeam) => {
        return playbookRunMapByTeam[teamId]?.[channelId];
    },
);

const emptyChecklistState = {} as Record<number, boolean>;

export const currentChecklistCollapsedState = (stateKey: string) => createSelector(
    'currentChecklistCollapsedState',
    pluginState,
    (plugin) => {
        return plugin.checklistCollapsedState[stateKey] ?? emptyChecklistState;
    },
);

export const currentChecklistAllCollapsed = (stateKey: string) => createSelector(
    'currentChecklistAllCollapsed',
    currentChecklistCollapsedState(stateKey),
    (checklistsState) => {
        if (Object.entries(checklistsState).length === 0) {
            return false;
        }

        for (const key in checklistsState) {
            if (!checklistsState[key]) {
                return false;
            }
        }
        return true;
    },
);

export const currentChecklistItemsFilter = (state: GlobalState, stateKey: string): ChecklistItemsFilter => {
    return pluginState(state).checklistItemsFilterByChannel[stateKey] || ChecklistItemsFilterDefault;
};

export const myActivePlaybookRunsList = createSelector(
    'myActivePlaybookRunsList',
    getCurrentTeamId,
    myPlaybookRunsByTeam,
    (teamId, playbookRunMapByTeam) => {
        const runMap = playbookRunMapByTeam[teamId];
        if (!runMap) {
            return [];
        }

        // return active playbook runs, sorted descending by create_at
        return Object.values(runMap)
            .filter((i) => playbookRunIsActive(i))
            .sort((a, b) => b.create_at - a.create_at);
    },
);

// myActivePlaybookRunsMap returns a map indexed by channelId->playbookRun for the current team
export const myPlaybookRunsMap = (state: GlobalState) => {
    return myPlaybookRunsByTeam(state)[getCurrentTeamId(state)] || {};
};

export const lastUpdatedByPlaybookRunId = createSelector(
    'lastUpdatedByPlaybookRunId',
    getCurrentTeamId,
    myPlaybookRunsByTeam,
    (teamId, playbookRunsMapByTeam) => {
        const result = {} as Record<string, number>;
        const playbookRunMap = playbookRunsMapByTeam[teamId];
        if (!playbookRunMap) {
            return {};
        }
        for (const playbookRun of Object.values(playbookRunMap)) {
            result[playbookRun.id] = findLastUpdated(playbookRun);
        }
        return result;
    },
);

const PROFILE_SET_ALL = 'all';

// sortAndInjectProfiles is an unexported function copied from mattermost-redux, it is called
// whenever a function returns a populated list of UserProfiles. Since getProfileSetForChannel is
// new, we have to sort and inject profiles before returning the list.
function sortAndInjectProfiles(profiles: IDMappedObjects<UserProfile>, profileSet?: 'all' | Array<UserProfile['id']> | Set<UserProfile['id']>): Array<UserProfile> {
    let currentProfiles: UserProfile[] = [];

    if (typeof profileSet === 'undefined') {
        return currentProfiles;
    } else if (profileSet === PROFILE_SET_ALL) {
        currentProfiles = Object.keys(profiles).map((key) => profiles[key]);
    } else {
        currentProfiles = Array.from(profileSet).map((p) => profiles[p]);
    }

    currentProfiles = currentProfiles.filter((profile) => Boolean(profile));

    return currentProfiles.sort(sortByUsername);
}

export const getProfileSetForChannel = (state: GlobalState, channelId: string) => {
    const profileSet = state.entities.users.profilesInChannel[channelId];
    const profiles = getUsers(state);
    return sortAndInjectProfiles(profiles, profileSet);
};

export const isPostMenuModalVisible = (state: GlobalState): boolean =>
    pluginState(state).postMenuModalVisibility;

export const isChannelActionsModalVisible = (state: GlobalState): boolean =>
    pluginState(state).channelActionsModalVisibility;

export const isRunActionsModalVisible = (state: GlobalState): boolean =>
    pluginState(state).runActionsModalVisibility;

export const isPlaybookActionsModalVisible = (state: GlobalState): boolean =>
    pluginState(state).playbookActionsModalVisibility;

export const isCurrentUserAdmin = createSelector(
    'isCurrentUserAdmin',
    getCurrentUser,
    (user) => {
        const rolesArray = user.roles.split(' ');
        return rolesArray.includes(General.SYSTEM_ADMIN_ROLE);
    },
);

export const isCurrentUserChannelAdmin = createSelector(
    'isCurrentUserChannelAdmin',
    getMyCurrentChannelMembership,
    (membership) => {
        return membership?.scheme_admin || false;
    },
);

export const isCurrentUserChannelMember = (channelId: string) => createSelector(
    'isCurrentUserChannelMember',
    getMyChannelMemberships,
    (memberships) => {
        return memberships[channelId]?.scheme_user || memberships[channelId]?.scheme_admin || false;
    },
);

export const hasViewedByChannelID = (state: GlobalState) => pluginState(state).hasViewedByChannel;

export const isTeamEdition = createSelector(
    'isTeamEdition',
    getConfig,
    (config) => config.BuildEnterpriseReady !== 'true',
);

const rhsAboutCollapsedState = (state: GlobalState): Record<string, boolean> => pluginState(state).rhsAboutCollapsedByChannel;

export const currentRHSAboutCollapsedState = createSelector(
    'currentRHSAboutCollapsedState',
    getCurrentChannelId,
    rhsAboutCollapsedState,
    (channelId, stateByChannel) => {
        return stateByChannel[channelId] ?? false;
    },
);

export const selectTeamsIHavePermissionToMakePlaybooksOn = (state: GlobalState) => {
    return getMyTeams(state).filter((team: Team) => (
        haveITeamPermission(state, team.id, 'playbook_public_create') ||
        haveITeamPermission(state, team.id, 'playbook_private_create')
    ));
};

export const selectExperimentalFeatures = (state: GlobalState) => Boolean(globalSettings(state)?.enable_experimental_features);

// Select tasks assigned to the current user, or unassigned but belonging to a run owned by the
// current user.
export const selectMyTasks = createSelector(
    'selectMyTasks',
    myPlaybookRuns,
    getCurrentUser,
    (playbookRuns, currentUser) => Object

        // Flatten to a list of playbook runs, ignoring the keys.
        .values(playbookRuns)

        // Only consider in progress runs.
        .filter((playbookRun) => playbookRun.current_status === PlaybookRunStatus.InProgress)

        // Flatten to a list of tasks, annotated with the playbook_run_id and checklist name.
        .flatMap((playbookRun) =>
            playbookRun.checklists.flatMap((checklist, checklistNum) =>
                checklist.items.map((item, itemNum) => ({
                    ...item,
                    item_num: itemNum,
                    playbook_run_id: playbookRun.id,
                    playbook_run_name: playbookRun.name,
                    playbook_run_owner_user_id: playbookRun.owner_user_id,
                    playbook_run_participant_user_ids: playbookRun.participant_ids,
                    playbook_run_create_at: playbookRun.create_at,
                    checklist_title: checklist.title,
                    checklist_num: checklistNum,
                }))
            )
        )

        // Filter to tasks assigned to the current user, or unassigned but belonging to a run
        // owned by the current user.
        .filter((checklistItem) =>
            checklistItem.assignee_id === currentUser.id ||
            (!checklistItem.assignee_id && checklistItem.playbook_run_owner_user_id === currentUser.id)
        )
);

export const isTaskOverdue = (item: ChecklistItem) => {
    if (item.due_date === 0 || DateTime.fromMillis(item.due_date) > DateTime.now()) {
        return false;
    }

    if (item.state === ChecklistItemState.Closed || item.state === ChecklistItemState.Skip) {
        return false;
    }

    return true;
};

// Determine if there are overdue tasks assigned to the current user, or unassigned but belonging
// to a run owned by the current user.
export const selectHasOverdueTasks = createSelector(
    'hasOverdueTasks',
    selectMyTasks,
    (myTasks) => myTasks.some((checklistItem) => isTaskOverdue(checklistItem))
);
