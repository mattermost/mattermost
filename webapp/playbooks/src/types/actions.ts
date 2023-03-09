// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Integrations from 'mattermost-redux/action_types/integrations';

import {PlaybookRun} from 'src/types/playbook_run';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';
import {pluginId} from 'src/manifest';
import {GlobalSettings} from 'src/types/settings';
import {ChecklistItemsFilter} from 'src/types/playbook';
import {PresetTemplate} from 'src/components/templates/template_data';

export const RECEIVED_TOGGLE_RHS_ACTION = pluginId + '_toggle_rhs';
export const SET_RHS_OPEN = pluginId + '_set_rhs_open';
export const SET_CLIENT_ID = pluginId + '_set_client_id';
export const PLAYBOOK_RUN_CREATED = pluginId + '_playbook_run_created';
export const PLAYBOOK_RUN_UPDATED = pluginId + '_playbook_run_updated';
export const PLAYBOOK_CREATED = pluginId + '_playbook_created';
export const PLAYBOOK_ARCHIVED = pluginId + '_playbook_archived';
export const PLAYBOOK_RESTORED = pluginId + '_playbook_restored';
export const RECEIVED_PLAYBOOK_RUNS = pluginId + '_received_playbook_runs';
export const RECEIVED_TEAM_PLAYBOOK_RUNS = pluginId + '_received_team_playbook_run_channels';
export const REMOVED_FROM_CHANNEL = pluginId + '_removed_from_playbook_run_channel';
export const RECEIVED_GLOBAL_SETTINGS = pluginId + '_received_global_settings';
export const SHOW_POST_MENU_MODAL = pluginId + '_show_post_menu_modal';
export const HIDE_POST_MENU_MODAL = pluginId + '_hide_post_menu_modal';
export const SHOW_CHANNEL_ACTIONS_MODAL = pluginId + '_show_channel_actions_modal';
export const HIDE_CHANNEL_ACTIONS_MODAL = pluginId + '_hide_channel_actions_modal';
export const SHOW_RUN_ACTIONS_MODAL = pluginId + '_show_run_actions_modal';
export const HIDE_RUN_ACTIONS_MODAL = pluginId + '_hide_run_actions_modal';
export const SHOW_PLAYBOOK_ACTIONS_MODAL = pluginId + '_show_playbook_actions_modal';
export const HIDE_PLAYBOOK_ACTIONS_MODAL = pluginId + '_hide_playbook_actions_modal';
export const SET_HAS_VIEWED_CHANNEL = pluginId + '_set_has_viewed';
export const SET_RHS_ABOUT_COLLAPSED_STATE = pluginId + '_set_rhs_about_collapsed_state';
export const SET_EVERY_CHECKLIST_COLLAPSED_STATE = pluginId + '_set_every_checklist_collapsed_state';
export const SET_CHECKLIST_COLLAPSED_STATE = pluginId + '_set_checklist_collapsed_state';
export const SET_ALL_CHECKLISTS_COLLAPSED_STATE = pluginId + '_set_all_checklists_collapsed_state';
export const SET_CHECKLIST_ITEMS_FILTER = pluginId + '_set_checklist_items_filter';

// Backstage RHS related action types
// Note That this is not the same as channel RHS management
// TODO: make a refactor with some naming change now we have multiple RHS
//       inside playbooks (channels RHS, Run details page RHS, backstage RHS)
export const OPEN_BACKSTAGE_RHS = pluginId + '_open_backstage_rhs';
export const CLOSE_BACKSTAGE_RHS = pluginId + '_close_backstage_rhs';

// This action is meant to be used by mattermost-webapp
// so we respect their naming convention (all caps)
export const PUBLISH_TEMPLATES = (pluginId + '_PUBLISH_TEMPLATES').toUpperCase();

export interface ReceivedToggleRHSAction {
    type: typeof RECEIVED_TOGGLE_RHS_ACTION;
    toggleRHSPluginAction: () => void;
}

export interface SetRHSOpen {
    type: typeof SET_RHS_OPEN;
    open: boolean;
}

export interface SetTriggerId {
    type: typeof Integrations.RECEIVED_DIALOG_TRIGGER_ID;
    data: string;
}

export interface SetClientId {
    type: typeof SET_CLIENT_ID;
    clientId: string;
}

export interface PlaybookRunCreated {
    type: typeof PLAYBOOK_RUN_CREATED;
    playbookRun: PlaybookRun;
}

export interface PlaybookRunUpdated {
    type: typeof PLAYBOOK_RUN_UPDATED;
    playbookRun: PlaybookRun;
}

export interface PlaybookCreated {
    type: typeof PLAYBOOK_CREATED;
    teamID: string;
}

export interface PlaybookArchived {
    type: typeof PLAYBOOK_ARCHIVED;
    teamID: string;
}

export interface PlaybookRestored {
    type: typeof PLAYBOOK_RESTORED;
    teamID: string;
}

export interface ReceivedPlaybookRuns {
    type: typeof RECEIVED_PLAYBOOK_RUNS;
    playbookRuns: PlaybookRun[];
}

export interface ReceivedTeamPlaybookRuns {
    type: typeof RECEIVED_TEAM_PLAYBOOK_RUNS;
    playbookRuns: PlaybookRun[];
}

export interface RemovedFromChannel {
    type: typeof REMOVED_FROM_CHANNEL;
    channelId: string;
}

export interface ReceivedGlobalSettings {
    type: typeof RECEIVED_GLOBAL_SETTINGS;
    settings: GlobalSettings;
}

export interface ShowPostMenuModal {
    type: typeof SHOW_POST_MENU_MODAL;
}

export interface HidePostMenuModal {
    type: typeof HIDE_POST_MENU_MODAL;
}

export interface ShowChannelActionsModal {
    type: typeof SHOW_CHANNEL_ACTIONS_MODAL;
}

export interface HideChannelActionsModal {
    type: typeof HIDE_CHANNEL_ACTIONS_MODAL;
}

export interface ShowRunActionsModal {
    type: typeof SHOW_RUN_ACTIONS_MODAL;
}

export interface HideRunActionsModal {
    type: typeof HIDE_RUN_ACTIONS_MODAL;
}

export interface ShowPlaybookActionsModal {
    type: typeof SHOW_PLAYBOOK_ACTIONS_MODAL;
}

export interface HidePlaybookActionsModal {
    type: typeof HIDE_PLAYBOOK_ACTIONS_MODAL;
}

export interface SetHasViewedChannel {
    type: typeof SET_HAS_VIEWED_CHANNEL;
    channelId: string;
    hasViewed: boolean;
}

export interface SetRHSAboutCollapsedState {
    type: typeof SET_RHS_ABOUT_COLLAPSED_STATE;
    channelId: string;
    collapsed: boolean;
}

export interface SetChecklistCollapsedState {
    type: typeof SET_CHECKLIST_COLLAPSED_STATE;
    key: string;
    checklistIndex: number;
    collapsed: boolean;
}

export interface SetEveryChecklistCollapsedState {
    type: typeof SET_EVERY_CHECKLIST_COLLAPSED_STATE;
    key: string;
    state: Record<number, boolean>;
}

export interface SetAllChecklistsCollapsedState {
    type: typeof SET_ALL_CHECKLISTS_COLLAPSED_STATE;
    key: string;
    numOfChecklists: number;
    collapsed: boolean;
}

export interface SetChecklistItemsFilter {
    type: typeof SET_CHECKLIST_ITEMS_FILTER;
    key: string;
    nextState: ChecklistItemsFilter;
}

// Backstage RHS related action types
// Note That this is not the same as channel RHS management
// TODO: make a refactor with some naming change now we have multiple RHS
//       inside playbooks (channels RHS, Run details page RHS, backstage RHS)
export interface OpenBackstageRHS {
    type: typeof OPEN_BACKSTAGE_RHS;
    section: BackstageRHSSection;
    viewMode: BackstageRHSViewMode;
}

export interface CloseBackstageRHS {
    type: typeof CLOSE_BACKSTAGE_RHS;
}

export interface PublishTemplates {
    type: typeof PUBLISH_TEMPLATES;
    templates: PresetTemplate[];
}
