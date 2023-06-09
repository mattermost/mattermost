// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';

export const OVERLAY_DELAY = 400;

export enum ErrorPageTypes {
    PLAYBOOK_RUNS = 'playbook_runs',
    PLAYBOOKS = 'playbooks',
    DEFAULT = 'default',
}

export const BACKSTAGE_LIST_PER_PAGE = 15;
export const PROFILE_CHUNK_SIZE = 200;
export const RUN_NAME_MAX_LENGTH = 64;

export enum AdminNotificationType {
    VIEW_TIMELINE = 'start_trial_to_view_timeline',
    MESSAGE_TO_TIMELINE = 'start_trial_to_add_message_to_timeline',
    RETROSPECTIVE = 'start_trial_to_access_retrospective',
    PLAYBOOK_GRANULAR_ACCESS = 'start_trial_to_restrict_playbook_access',
    PLAYBOOK_CREATION_RESTRICTION = 'start_trial_to_restrict_playbook_creation',
    EXPORT_CHANNEL = 'start_trial_to_export_channel',
    MESSAGE_TO_PLAYBOOK_DASHBOARD = 'start_trial_to_access_playbook_dashboard',
    PLAYBOOK_METRICS = 'start_trial_to_access_metrics',
    CHECKLIST_ITEM_DUE_DATE = 'start_trial_to_set_checklist_item_due_date',
    REQUEST_UPDATE = 'start_trial_to_request_update',
}

export const DateTimeFormats = {
    // eslint-disable-next-line no-undefined
    DATE_MED_NO_YEAR: {...DateTime.DATE_MED, year: undefined},
};

// TODO: Unify from channels
export const AboutLinks = {
    PRIVACY_POLICY: 'https://mattermost.com/pl/privacy-policy/',
};

export const CallsSlashCommandPrefix = '/call ';
