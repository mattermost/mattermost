// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {AnyAction, Dispatch} from 'redux';

import {generateId} from 'mattermost-redux/utils/helpers';
import {IntegrationTypes} from 'mattermost-redux/action_types';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {GetStateFunc} from 'mattermost-redux/types/actions';

import {makeModalDefinition as makeUpdateRunNameModalDefinition} from 'src/components/modals/run_update_name';
import {makeModalDefinition as makeUpdateRunChannelModalDefinition} from 'src/components/modals/run_update_channel';
import {makeModalDefinition as makePlaybookRunModalDefinition} from 'src/components/modals/run_playbook_modal';
import {PlaybookRun} from 'src/types/playbook_run';
import {canIPostUpdateForRun, selectToggleRHS} from 'src/selectors';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import {
    CLOSE_BACKSTAGE_RHS,
    CloseBackstageRHS,
    HIDE_CHANNEL_ACTIONS_MODAL,
    HIDE_PLAYBOOK_ACTIONS_MODAL,
    HIDE_POST_MENU_MODAL,
    HIDE_RUN_ACTIONS_MODAL,
    HideChannelActionsModal,
    HidePlaybookActionsModal,
    HidePostMenuModal,
    HideRunActionsModal,
    OPEN_BACKSTAGE_RHS,
    OpenBackstageRHS,
    PLAYBOOK_ARCHIVED,
    PLAYBOOK_CREATED,
    PLAYBOOK_RESTORED,
    PLAYBOOK_RUN_CREATED,
    PLAYBOOK_RUN_UPDATED,
    PUBLISH_TEMPLATES,
    PlaybookArchived,
    PlaybookCreated,
    PlaybookRestored,
    PlaybookRunCreated,
    PlaybookRunUpdated,
    PublishTemplates,
    RECEIVED_GLOBAL_SETTINGS,
    RECEIVED_PLAYBOOK_RUNS,
    RECEIVED_TEAM_PLAYBOOK_RUNS,
    RECEIVED_TOGGLE_RHS_ACTION,
    REMOVED_FROM_CHANNEL,
    ReceivedGlobalSettings,
    ReceivedPlaybookRuns,
    ReceivedTeamPlaybookRuns,
    ReceivedToggleRHSAction,
    RemovedFromChannel,
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
    SetTriggerId,
    ShowChannelActionsModal,
    ShowPlaybookActionsModal,
    ShowPostMenuModal,
    ShowRunActionsModal,
} from 'src/types/actions';
import {clientExecuteCommand} from 'src/client';
import {GlobalSettings} from 'src/types/settings';
import {ChecklistItemsFilter, TaskAction as TaskActionType} from 'src/types/playbook';
import {modals} from 'src/webapp_globals';
import {makeModalDefinition as makeUpdateRunStatusModalDefinition} from 'src/components/modals/update_run_status_modal';
import {makePlaybookAccessModalDefinition} from 'src/components/backstage/playbook_access_modal';

import {PlaybookCreateModalProps, makePlaybookCreateModal} from 'src/components/create_playbook_modal';
import {makeRhsRunDetailsTourDialog} from 'src/components/rhs/rhs_run_details_tour_dialog';
import {PresetTemplate} from 'src/components/templates/template_data';
import {makeTaskActionsModalDefinition} from 'src/components/checklist_item/task_actions_modal';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

export function startPlaybookRun(teamId: string, postId?: string) {
    return async (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        // Add unique id
        const clientId = generateId();
        dispatch(setClientId(clientId));

        let command = `/playbook run ${clientId}`;
        if (postId) {
            command = `${command} ${postId}`;
        }

        await clientExecuteCommand(dispatch, getState, command, teamId);
    };
}

export function openUpdateRunNameModal(playbookRunId: string, onSubmit: (newName: string) => void) {
    return modals.openModal(makeUpdateRunNameModalDefinition({
        playbookRunId,
        onSubmit,
    }));
}

export function openUpdateRunChannelModal(playbookRunId: string, teamId: string, type: PlaybookRunType, onSubmit: (newChannelId: string, newChannelName: string) => void) {
    return modals.openModal(makeUpdateRunChannelModalDefinition({
        playbookRunId,
        teamId,
        onSubmit,
    }));
}

type newRunModalProps = {
    playbookId?: string,
    triggerChannelId?: string,
    teamId: string,
    onRunCreated: (runId: string, channelId: string, statsData: object) => void,
};

export function openPlaybookRunModal(dialogProps: newRunModalProps) {
    return modals.openModal(makePlaybookRunModalDefinition(
        dialogProps.playbookId,
        dialogProps.triggerChannelId,
        dialogProps.teamId,
        dialogProps.onRunCreated,
    ));
}

export function promptUpdateStatus(
    teamId: string,
    playbookRunId: string,
    channelId: string,
) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        const state = getState();
        const hasPermission = canIPostUpdateForRun(state, channelId, teamId);
        dispatch(openUpdateRunStatusModal(playbookRunId, channelId, hasPermission));
    };
}

export function openUpdateRunStatusModal(
    playbookRunId: string,
    channelId: string,
    hasPermission: boolean,
    message?: string,
    reminderInSeconds?: number,
    finishRunChecked?: boolean
) {
    return modals.openModal(makeUpdateRunStatusModalDefinition({
        playbookRunId,
        channelId,
        hasPermission,
        message,
        reminderInSeconds,
        finishRunChecked,
    }));
}

export function displayEditPlaybookAccessModal(
    playbookId: string,
    refetch?: () => void,
) {
    return async (dispatch: Dispatch<AnyAction>) => {
        dispatch(modals.openModal(makePlaybookAccessModalDefinition({playbookId, refetch})));
    };
}

export function displayPlaybookCreateModal(props: PlaybookCreateModalProps) {
    return async (dispatch: Dispatch<AnyAction>) => {
        dispatch(modals.openModal(makePlaybookCreateModal(props)));
    };
}

export function displayRhsRunDetailsTourDialog(props: Parameters<typeof makeRhsRunDetailsTourDialog>[0]) {
    return async (dispatch: Dispatch<AnyAction>) => {
        dispatch(modals.openModal(makeRhsRunDetailsTourDialog(props)));
    };
}

export function finishRun(teamId: string, playbookRunId: string) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        await clientExecuteCommand(dispatch, getState, `/playbook finish-by-id ${playbookRunId}`, teamId);
    };
}

export function addToTimeline(postId: string) {
    return async (dispatch: Dispatch, getState: GetStateFunc) => {
        const currentTeamId = getCurrentTeamId(getState());

        await clientExecuteCommand(dispatch, getState, `/playbook add ${postId}`, currentTeamId);
    };
}

export function setRHSOpen(open: boolean): SetRHSOpen {
    return {
        type: SET_RHS_OPEN,
        open,
    };
}

/**
 * Stores`showRHSPlugin` action returned by
 * registerRightHandSidebarComponent in plugin initialization.
 */
export function setToggleRHSAction(toggleRHSPluginAction: () => void): ReceivedToggleRHSAction {
    return {
        type: RECEIVED_TOGGLE_RHS_ACTION,
        toggleRHSPluginAction,
    };
}

export function toggleRHS() {
    return (dispatch: Dispatch<AnyAction>, getState: GetStateFunc) => {
        selectToggleRHS(getState())();
    };
}

export function setTriggerId(triggerId: string): SetTriggerId {
    return {
        type: IntegrationTypes.RECEIVED_DIALOG_TRIGGER_ID,
        data: triggerId,
    };
}

export function setClientId(clientId: string): SetClientId {
    return {
        type: SET_CLIENT_ID,
        clientId,
    };
}

export const playbookRunCreated = (playbookRun: PlaybookRun): PlaybookRunCreated => ({
    type: PLAYBOOK_RUN_CREATED,
    playbookRun,
});

export const playbookRunUpdated = (playbookRun: PlaybookRun): PlaybookRunUpdated => ({
    type: PLAYBOOK_RUN_UPDATED,
    playbookRun,
});

export const playbookCreated = (teamID: string): PlaybookCreated => ({
    type: PLAYBOOK_CREATED,
    teamID,
});

export const playbookArchived = (teamID: string): PlaybookArchived => ({
    type: PLAYBOOK_ARCHIVED,
    teamID,
});

export const playbookRestored = (teamID: string): PlaybookRestored => ({
    type: PLAYBOOK_RESTORED,
    teamID,
});

export const receivedPlaybookRuns = (playbookRuns: PlaybookRun[]): ReceivedPlaybookRuns => ({
    type: RECEIVED_PLAYBOOK_RUNS,
    playbookRuns,
});

export const receivedTeamPlaybookRuns = (playbookRuns: PlaybookRun[]): ReceivedTeamPlaybookRuns => ({
    type: RECEIVED_TEAM_PLAYBOOK_RUNS,
    playbookRuns,
});

export const removedFromPlaybookRunChannel = (channelId: string): RemovedFromChannel => ({
    type: REMOVED_FROM_CHANNEL,
    channelId,
});

export const actionSetGlobalSettings = (settings: GlobalSettings): ReceivedGlobalSettings => ({
    type: RECEIVED_GLOBAL_SETTINGS,
    settings,
});

export const showPostMenuModal = (): ShowPostMenuModal => ({
    type: SHOW_POST_MENU_MODAL,
});

export const hidePostMenuModal = (): HidePostMenuModal => ({
    type: HIDE_POST_MENU_MODAL,
});

export const showChannelActionsModal = (): ShowChannelActionsModal => ({
    type: SHOW_CHANNEL_ACTIONS_MODAL,
});

export const hideChannelActionsModal = (): HideChannelActionsModal => ({
    type: HIDE_CHANNEL_ACTIONS_MODAL,
});

export const showRunActionsModal = (): ShowRunActionsModal => ({
    type: SHOW_RUN_ACTIONS_MODAL,
});

export const hideRunActionsModal = (): HideRunActionsModal => ({
    type: HIDE_RUN_ACTIONS_MODAL,
});

export const showPlaybookActionsModal = (): ShowPlaybookActionsModal => ({
    type: SHOW_PLAYBOOK_ACTIONS_MODAL,
});

export const hidePlaybookActionsModal = (): HidePlaybookActionsModal => ({
    type: HIDE_PLAYBOOK_ACTIONS_MODAL,
});

export const setHasViewedChannel = (channelId: string): SetHasViewedChannel => ({
    type: SET_HAS_VIEWED_CHANNEL,
    channelId,
    hasViewed: true,
});

export const setRHSAboutCollapsedState = (channelId: string, collapsed: boolean): SetRHSAboutCollapsedState => ({
    type: SET_RHS_ABOUT_COLLAPSED_STATE,
    channelId,
    collapsed,
});

export const setChecklistCollapsedState = (key: string, checklistIndex: number, collapsed: boolean): SetChecklistCollapsedState => ({
    type: SET_CHECKLIST_COLLAPSED_STATE,
    key,
    checklistIndex,
    collapsed,
});

export const setEveryChecklistCollapsedStateChange = (key: string, state: Record<number, boolean>): SetEveryChecklistCollapsedState => ({
    type: SET_EVERY_CHECKLIST_COLLAPSED_STATE,
    key,
    state,
});

export const setAllChecklistsCollapsedState = (key: string, collapsed: boolean, numOfChecklists: number): SetAllChecklistsCollapsedState => ({
    type: SET_ALL_CHECKLISTS_COLLAPSED_STATE,
    key,
    numOfChecklists,
    collapsed,
});

export const setChecklistItemsFilter = (key: string, nextState: ChecklistItemsFilter): SetChecklistItemsFilter => ({
    type: SET_CHECKLIST_ITEMS_FILTER,
    key,
    nextState,
});

export function openTaskActionsModal(onTaskActionsChange: (newTaskActions: TaskActionType[]) => void, taskActions?: TaskActionType[] | null) {
    return modals.openModal(makeTaskActionsModalDefinition(onTaskActionsChange, taskActions));
}

export const closeBackstageRHS = (): CloseBackstageRHS => ({
    type: CLOSE_BACKSTAGE_RHS,
});

export const openBackstageRHS = (section: BackstageRHSSection, viewMode: BackstageRHSViewMode): OpenBackstageRHS => ({
    type: OPEN_BACKSTAGE_RHS,
    section,
    viewMode,
});

export const publishTemplates = (templates: PresetTemplate[]): PublishTemplates => ({
    type: PUBLISH_TEMPLATES,
    templates,
});
