// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {Team} from '@mattermost/types/teams';
import {Channel} from '@mattermost/types/channels';

import {PlaybookRun, isRun} from 'src/types/playbook_run';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import {Condition} from 'src/types/conditions';
import {ChecklistItemsFilter, Playbook} from 'src/types/playbook';
import {PropertyField} from 'src/types/properties';
import {
    ADDED_PLAYBOOK_PROPERTY_FIELD,
    AddedPlaybookPropertyField,
    CLOSE_BACKSTAGE_RHS,
    CONDITION_CREATED,
    CONDITION_DELETED,
    CONDITION_UPDATED,
    CloseBackstageRHS,
    ConditionCreated,
    ConditionDeleted,
    ConditionUpdated,
    DELETED_PLAYBOOK_PROPERTY_FIELD,
    DeletedPlaybookPropertyField,
    HIDE_CHANNEL_ACTIONS_MODAL,
    HIDE_PLAYBOOK_ACTIONS_MODAL,
    HIDE_POST_MENU_MODAL,
    HIDE_RUN_ACTIONS_MODAL,
    HidePlaybookActionsModal,
    HidePostMenuModal,
    HideRunActionsModal,
    OPEN_BACKSTAGE_RHS,
    OpenBackstageRHS,
    PLAYBOOK_RUN_CREATED,
    PLAYBOOK_RUN_UPDATED,
    PlaybookRunCreated,
    PlaybookRunUpdated,
    RECEIVED_GLOBAL_SETTINGS,
    RECEIVED_PLAYBOOK_CONDITIONS,
    RECEIVED_PLAYBOOK_PROPERTY_FIELDS,
    RECEIVED_PLAYBOOK_RUNS,
    RECEIVED_TEAM_PLAYBOOK_RUNS,
    RECEIVED_TEAM_PLAYBOOK_RUN_CONNECTIONS,
    RECEIVED_TOGGLE_RHS_ACTION,
    REMOVED_FROM_CHANNEL,
    REORDERED_PLAYBOOK_PROPERTY_FIELDS,
    ReceivedGlobalSettings,
    ReceivedPlaybookConditions,
    ReceivedPlaybookPropertyFields,
    ReceivedPlaybookRuns,
    ReceivedTeamPlaybookRunConnections,
    ReceivedTeamPlaybookRuns,
    ReceivedToggleRHSAction,
    RemovedFromChannel,
    ReorderedPlaybookPropertyFields,
    SET_ALL_CHECKLISTS_COLLAPSED_STATE,
    SET_CHECKLIST_COLLAPSED_STATE,
    SET_CHECKLIST_ITEMS_FILTER,
    SET_CLIENT_ID,
    SET_EVERY_CHECKLIST_COLLAPSED_STATE,
    SET_HAS_VIEWED_CHANNEL,
    SET_RHS_ABOUT_COLLAPSED_STATE,
    SET_RHS_OPEN,
    SHOW_CHANNEL_ACTIONS_MODAL,
    SHOW_PLAYBOOK_ACTIONS_MODAL,
    SHOW_POST_MENU_MODAL,
    SHOW_RUN_ACTIONS_MODAL,
    SetAllChecklistsCollapsedState,
    SetChecklistCollapsedState,
    SetChecklistItemsFilter,
    SetClientId,
    SetEveryChecklistCollapsedState,
    SetHasViewedChannel,
    SetRHSAboutCollapsedState,
    SetRHSOpen,
    ShowChannelActionsModal,
    ShowPlaybookActionsModal,
    ShowPostMenuModal,
    ShowRunActionsModal,
    UPDATED_PLAYBOOK_PROPERTY_FIELD,
    UpdatedPlaybookPropertyField,
    WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED,
    WebsocketPlaybookRunIncrementalUpdateReceived,
} from 'src/types/actions';
import {GlobalSettings} from 'src/types/settings';
import {applyIncrementalUpdate} from 'src/utils/playbook_run_updates';
function toggleRHSFunction(state = null, action: ReceivedToggleRHSAction) {
    switch (action.type) {
    case RECEIVED_TOGGLE_RHS_ACTION:
        return action.toggleRHSPluginAction;
    default:
        return state;
    }
}

function rhsOpen(state = false, action: SetRHSOpen) {
    switch (action.type) {
    case SET_RHS_OPEN:
        return action.open || false;
    default:
        return state;
    }
}

function clientId(state = '', action: SetClientId) {
    switch (action.type) {
    case SET_CLIENT_ID:
        return action.clientId || '';
    default:
        return state;
    }
}

type TStateConditions = Record<Condition['id'], Condition>;
type TStateConditionsPerPlaybook = Record<Playbook['id'], Condition['id'][]>;

type TStateMyPlaybookRuns = Record<PlaybookRun['id'], PlaybookRun>;

/**
 * @returns a map of playbookRunId -> playbookRun for all playbook runs for which the current user
 * is a playbook run member.
 * @remarks
 * It is lazy loaded on team change, but will also track incremental updates as provided by websocket events.
 */
const myPlaybookRuns = (
    state: TStateMyPlaybookRuns = {},
    action: PlaybookRunCreated | PlaybookRunUpdated | ReceivedTeamPlaybookRuns | RemovedFromChannel | WebsocketPlaybookRunIncrementalUpdateReceived
): TStateMyPlaybookRuns => {
    switch (action.type) {
    case PLAYBOOK_RUN_CREATED: {
        const playbookRunCreatedAction = action as PlaybookRunCreated;
        const playbookRun = playbookRunCreatedAction.playbookRun;
        return {
            ...state,
            [playbookRun.id]: playbookRun,
        };
    }

    case PLAYBOOK_RUN_UPDATED: {
        const playbookRunUpdated = action as PlaybookRunUpdated;
        const playbookRun = playbookRunUpdated.playbookRun;
        return {
            ...state,
            [playbookRun.id]: playbookRun,
        };
    }

    case RECEIVED_PLAYBOOK_RUNS: {
        const receivedPlaybookRunsAction = action as ReceivedPlaybookRuns;
        const playbookRuns = receivedPlaybookRunsAction.playbookRuns;
        if (playbookRuns.length === 0) {
            return state;
        }

        const newState = {
            ...state,
        };

        for (const playbookRun of playbookRuns) {
            newState[playbookRun.id] = playbookRun;
        }

        return newState;
    }

    case RECEIVED_TEAM_PLAYBOOK_RUNS: {
        const receivedTeamPlaybookRunsAction = action as ReceivedTeamPlaybookRuns;
        const playbookRuns = receivedTeamPlaybookRunsAction.playbookRuns;
        if (playbookRuns.length === 0) {
            return state;
        }

        const newState = {
            ...state,
        };

        for (const playbookRun of playbookRuns) {
            newState[playbookRun.id] = playbookRun;
        }

        return newState;
    }

    case WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED: {
        const wsAction = action as WebsocketPlaybookRunIncrementalUpdateReceived;
        const runId = wsAction.data.id;
        const currentRun = state[runId];

        if (!currentRun) {
            // Run not found in state - it might not be loaded yet
            // Return state unchanged and let other mechanisms handle fetching
            return state;
        }

        const updatedRun = applyIncrementalUpdate(currentRun, wsAction.data);
        return {
            ...state,
            [runId]: updatedRun,
        };
    }

    default:
        return state;
    }
};

/**
 * @returns a map of conditionId -> condition for all conditions
 */
const conditions = (
    state: TStateConditions = {},
    action: ReceivedPlaybookConditions | ConditionCreated | ConditionUpdated | ConditionDeleted
): TStateConditions => {
    switch (action.type) {
    case RECEIVED_PLAYBOOK_CONDITIONS: {
        const receivedAction = action as ReceivedPlaybookConditions;
        const newState = {...state};
        receivedAction.conditions.forEach((condition) => {
            newState[condition.id] = condition;
        });
        return newState;
    }
    case CONDITION_CREATED:
    case CONDITION_UPDATED: {
        const conditionAction = action as ConditionCreated | ConditionUpdated;
        return {
            ...state,
            [conditionAction.condition.id]: conditionAction.condition,
        };
    }
    case CONDITION_DELETED: {
        const deletedAction = action as ConditionDeleted;
        const newState = {...state};
        delete newState[deletedAction.conditionId];
        return newState;
    }
    default:
        return state;
    }
};

/**
 * @returns a map of playbookId -> conditionId[] for all playbook conditions
 */
const conditionsPerPlaybook = (
    state: TStateConditionsPerPlaybook = {},
    action: ReceivedPlaybookConditions | ConditionCreated | ConditionUpdated | ConditionDeleted
): TStateConditionsPerPlaybook => {
    switch (action.type) {
    case RECEIVED_PLAYBOOK_CONDITIONS: {
        const receivedAction = action as ReceivedPlaybookConditions;
        const conditionIds = receivedAction.conditions.map((condition) => condition.id);
        return {
            ...state,
            [receivedAction.playbookId]: conditionIds,
        };
    }
    case CONDITION_CREATED: {
        const createdAction = action as ConditionCreated;
        const currentConditions = state[createdAction.condition.playbook_id] || [];
        return {
            ...state,
            [createdAction.condition.playbook_id]: [...currentConditions, createdAction.condition.id],
        };
    }
    case CONDITION_UPDATED: {
        // No change needed for updates, the condition ID stays the same
        return state;
    }
    case CONDITION_DELETED: {
        const deletedAction = action as ConditionDeleted;
        const currentConditions = state[deletedAction.playbookId] || [];
        return {
            ...state,
            [deletedAction.playbookId]: currentConditions.filter((id) => id !== deletedAction.conditionId),
        };
    }
    default:
        return state;
    }
};

type TStateMyPlaybookRunsByTeam = Record<Team['id'], null | Record<Channel['id'], PlaybookRun>>;

/**
 * @returns a map of teamId->{channelId->playbookRuns} for which the current user is a playbook run member
 * @remarks
 * It is lazy loaded on team change, but will also track incremental updates as provided by websocket events.
 */
const myPlaybookRunsByTeam = (
    state: TStateMyPlaybookRunsByTeam = {},
    action:
        PlaybookRunCreated |
        PlaybookRunUpdated |
        ReceivedTeamPlaybookRuns |
        ReceivedTeamPlaybookRunConnections |
        RemovedFromChannel |
        WebsocketPlaybookRunIncrementalUpdateReceived
): TStateMyPlaybookRunsByTeam => {
    switch (action.type) {
    case PLAYBOOK_RUN_CREATED: {
        const playbookRunCreatedAction = action as PlaybookRunCreated;
        const playbookRun = playbookRunCreatedAction.playbookRun;
        const teamId = playbookRun.team_id;
        return {
            ...state,
            [teamId]: {
                ...state[teamId],
                [playbookRun.channel_id]: playbookRun,
            },
        };
    }
    case PLAYBOOK_RUN_UPDATED: {
        const playbookRunUpdated = action as PlaybookRunUpdated;
        const playbookRun = playbookRunUpdated.playbookRun;
        const teamId = playbookRun.team_id;
        return {
            ...state,
            [teamId]: {
                ...state[teamId],
                [playbookRun.channel_id]: playbookRun,
            },
        };
    }

    // TODO https://mattermost.atlassian.net/browse/MM-65733
    case RECEIVED_TEAM_PLAYBOOK_RUN_CONNECTIONS:
    case RECEIVED_TEAM_PLAYBOOK_RUNS: {
        const receivedTeamPlaybookRunsAction = action as ReceivedTeamPlaybookRuns;
        const playbookRuns = receivedTeamPlaybookRunsAction.playbookRuns;
        if (playbookRuns.length === 0) {
            return state;
        }
        const teamId = playbookRuns[0].team_id;
        const newState = {
            ...state,
            [teamId]: {
                ...state[teamId],
            },
        };

        for (const playbookRun of playbookRuns) {
            const tx = newState[teamId];
            if (tx) {
                tx[playbookRun.channel_id] = playbookRun;
            }
        }

        return newState;
    }
    case REMOVED_FROM_CHANNEL: {
        const removedFromChannelAction = action as RemovedFromChannel;
        const channelId = removedFromChannelAction.channelId;
        const teamId = Object.keys(state).find((t) => Boolean(state[t]?.[channelId]));
        if (!teamId) {
            return state;
        }

        const newState = {
            ...state,
            [teamId]: {...state[teamId]},
        };
        const runMap = newState[teamId];
        if (runMap) {
            delete runMap[channelId];
        }
        return newState;
    }

    case WEBSOCKET_PLAYBOOK_RUN_INCREMENTAL_UPDATE_RECEIVED: {
        const wsAction = action as WebsocketPlaybookRunIncrementalUpdateReceived;
        const runId = wsAction.data.id;

        // Find the team and channel for this run
        let targetTeamId: string | null = null;
        let targetChannelId: string | null = null;

        for (const teamId of Object.keys(state)) {
            const teamData = state[teamId];
            if (teamData) {
                for (const channelId of Object.keys(teamData)) {
                    if (teamData[channelId]?.id === runId) {
                        targetTeamId = teamId;
                        targetChannelId = channelId;
                        break;
                    }
                }
                if (targetTeamId) {
                    break;
                }
            }
        }

        if (!targetTeamId || !targetChannelId) {
            return state;
        }

        const currentRun = state[targetTeamId]?.[targetChannelId];
        if (!isRun(currentRun)) {
            return state;
        }

        const updatedRun = applyIncrementalUpdate(currentRun, wsAction.data);
        return {
            ...state,
            [targetTeamId]: {
                ...state[targetTeamId],
                [targetChannelId]: updatedRun,
            },
        };
    }

    default:
        return state;
    }
};

const globalSettings = (state: GlobalSettings | null = null, action: ReceivedGlobalSettings) => {
    switch (action.type) {
    case RECEIVED_GLOBAL_SETTINGS:
        return action.settings;
    default:
        return state;
    }
};

const postMenuModalVisibility = (state = false, action: ShowPostMenuModal | HidePostMenuModal) => {
    switch (action.type) {
    case SHOW_POST_MENU_MODAL:
        return true;
    case HIDE_POST_MENU_MODAL:
        return false;
    default:
        return state;
    }
};

const channelActionsModalVisibility = (state = false, action: ShowChannelActionsModal) => {
    switch (action.type) {
    case SHOW_CHANNEL_ACTIONS_MODAL:
        return true;
    case HIDE_CHANNEL_ACTIONS_MODAL:
        return false;
    default:
        return state;
    }
};

const runActionsModalVisibility = (state = false, action: ShowRunActionsModal | HideRunActionsModal) => {
    switch (action.type) {
    case SHOW_RUN_ACTIONS_MODAL:
        return true;
    case HIDE_RUN_ACTIONS_MODAL:
        return false;
    default:
        return state;
    }
};

const playbookActionsModalVisibility = (state = false, action: ShowPlaybookActionsModal | HidePlaybookActionsModal) => {
    switch (action.type) {
    case SHOW_PLAYBOOK_ACTIONS_MODAL:
        return true;
    case HIDE_PLAYBOOK_ACTIONS_MODAL:
        return false;
    default:
        return state;
    }
};

const hasViewedByChannel = (state: Record<string, boolean> = {}, action: SetHasViewedChannel) => {
    switch (action.type) {
    case SET_HAS_VIEWED_CHANNEL:
        return {
            ...state,
            [action.channelId]: action.hasViewed,
        };
    default:
        return state;
    }
};

const rhsAboutCollapsedByRun = (state: Record<string, boolean> = {}, action: SetRHSAboutCollapsedState) => {
    switch (action.type) {
    case SET_RHS_ABOUT_COLLAPSED_STATE:
        return {
            ...state,
            [action.runId]: action.collapsed,
        };
    default:
        return state;
    }
};

// checklistCollapsedState keeps a map of channelId -> checklist number -> collapsed
const checklistCollapsedState = (
    state: Record<string, Record<number, boolean>> = {},
    action:
    | SetChecklistCollapsedState
    | SetAllChecklistsCollapsedState
    | SetEveryChecklistCollapsedState
) => {
    switch (action.type) {
    case SET_CHECKLIST_COLLAPSED_STATE: {
        const setAction = action as SetChecklistCollapsedState;
        return {
            ...state,
            [setAction.key]: {
                ...state[setAction.key],
                [setAction.checklistIndex]: setAction.collapsed,
            },
        };
    }
    case SET_ALL_CHECKLISTS_COLLAPSED_STATE: {
        const setAction = action as SetAllChecklistsCollapsedState;
        const newState: Record<number, boolean> = {};
        for (let i = 0; i < setAction.numOfChecklists; i++) {
            newState[i] = setAction.collapsed;
        }
        return {
            ...state,
            [setAction.key]: newState,
        };
    }
    case SET_EVERY_CHECKLIST_COLLAPSED_STATE: {
        const setAction = action as SetEveryChecklistCollapsedState;
        return {
            ...state,
            [setAction.key]: setAction.state,
        };
    }
    default:
        return state;
    }
};

const checklistItemsFilterByChannel = (state: Record<string, ChecklistItemsFilter> = {}, action: SetChecklistItemsFilter) => {
    switch (action.type) {
    case SET_CHECKLIST_ITEMS_FILTER:
        return {
            ...state,
            [action.key]: action.nextState,
        };
    default:
        return state;
    }
};

// Backstage RHS related reducer
// Note That this is not the same as channel RHS management
// TODO: make a refactor with some naming change now we have multiple RHS
//       inside playbooks (channels RHS, Run details page RHS, backstage RHS)
export type backstageRHSState = {
    isOpen: boolean;
    viewMode: BackstageRHSViewMode;
    section: BackstageRHSSection;
}
const initialBackstageRHSState = {
    isOpen: false,
    viewMode: BackstageRHSViewMode.Overlap,
    section: BackstageRHSSection.TaskInbox,
};

const backstageRHS = (state: backstageRHSState = initialBackstageRHSState, action: OpenBackstageRHS | CloseBackstageRHS) => {
    switch (action.type) {
    case OPEN_BACKSTAGE_RHS: {
        const openAction = action as OpenBackstageRHS;
        return {isOpen: true, viewMode: openAction.viewMode, section: openAction.section};
    }
    case CLOSE_BACKSTAGE_RHS:
        return {...state, isOpen: false};
    default:
        return state;
    }
};

type TStatePropertyFields = Record<PropertyField['id'], PropertyField>;

const propertyFields = (
    state: TStatePropertyFields = {},
    action: ReceivedPlaybookPropertyFields | AddedPlaybookPropertyField | UpdatedPlaybookPropertyField | DeletedPlaybookPropertyField
): TStatePropertyFields => {
    switch (action.type) {
    case RECEIVED_PLAYBOOK_PROPERTY_FIELDS: {
        const receivedAction = action as ReceivedPlaybookPropertyFields;
        const newState = {...state};
        receivedAction.propertyFields.forEach((field) => {
            newState[field.id] = field;
        });
        return newState;
    }
    case ADDED_PLAYBOOK_PROPERTY_FIELD: {
        const addedAction = action as AddedPlaybookPropertyField;
        return {
            ...state,
            [addedAction.propertyField.id]: addedAction.propertyField,
        };
    }
    case UPDATED_PLAYBOOK_PROPERTY_FIELD: {
        const updatedAction = action as UpdatedPlaybookPropertyField;
        return {
            ...state,
            [updatedAction.propertyField.id]: updatedAction.propertyField,
        };
    }
    case DELETED_PLAYBOOK_PROPERTY_FIELD: {
        const deletedAction = action as DeletedPlaybookPropertyField;
        const newState = {...state};
        delete newState[deletedAction.fieldId];
        return newState;
    }
    default:
        return state;
    }
};

type TStatePropertyFieldsPerPlaybook = Record<Playbook['id'], PropertyField['id'][]>;

const propertyFieldsPerPlaybook = (
    state: TStatePropertyFieldsPerPlaybook = {},
    action: ReceivedPlaybookPropertyFields | AddedPlaybookPropertyField | ReorderedPlaybookPropertyFields
): TStatePropertyFieldsPerPlaybook => {
    switch (action.type) {
    case RECEIVED_PLAYBOOK_PROPERTY_FIELDS: {
        const receivedAction = action as ReceivedPlaybookPropertyFields;
        const fieldIds = receivedAction.propertyFields.map((field) => field.id);
        return {
            ...state,
            [receivedAction.playbookId]: fieldIds,
        };
    }
    case ADDED_PLAYBOOK_PROPERTY_FIELD: {
        const addedAction = action as AddedPlaybookPropertyField;
        const currentIds = state[addedAction.playbookId] || [];
        return {
            ...state,
            [addedAction.playbookId]: [...currentIds, addedAction.propertyField.id],
        };
    }
    case REORDERED_PLAYBOOK_PROPERTY_FIELDS: {
        const reorderedAction = action as ReorderedPlaybookPropertyFields;
        return {
            ...state,
            [reorderedAction.playbookId]: reorderedAction.reorderedFieldIds,
        };
    }
    default:
        return state;
    }
};

const reducer = combineReducers({
    toggleRHSFunction,
    rhsOpen,
    clientId,
    myPlaybookRuns,
    myPlaybookRunsByTeam,
    conditions,
    conditionsPerPlaybook,
    propertyFields,
    propertyFieldsPerPlaybook,
    globalSettings,
    postMenuModalVisibility,
    channelActionsModalVisibility,
    runActionsModalVisibility,
    playbookActionsModalVisibility,
    hasViewedByChannel,
    rhsAboutCollapsedByRun,
    checklistCollapsedState,
    checklistItemsFilterByChannel,
    backstageRHS,
});

export default reducer;

export type PlaybooksPluginState = ReturnType<typeof reducer>;
