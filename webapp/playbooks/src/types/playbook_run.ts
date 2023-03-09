// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimelineEvent} from 'src/types/rhs';
import {Checklist, ChecklistItem} from 'src/types/playbook';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

export interface PlaybookRun {
    id: string;
    name: string;
    summary: string;
    summary_modified_at: number;
    owner_user_id: string;
    reporter_user_id: string;
    team_id: string;
    channel_id: string;
    create_at: number;
    end_at: number;
    post_id: string;
    playbook_id: string;
    checklists: Checklist[];
    status_posts: StatusPost[];
    current_status: PlaybookRunStatus;
    last_status_update_at: number;
    reminder_post_id: string;
    reminder_message_template: string;
    reminder_timer_default_seconds: number;
    status_update_enabled: boolean;
    broadcast_channel_ids: string[];
    status_update_broadcast_webhooks_enabled: boolean;
    webhook_on_status_update_urls: string[];

    /** Whether run updates should be broadcasted to channels */
    status_update_broadcast_channels_enabled: boolean;

    /** Previous reminder timer as nanoseconds */
    previous_reminder: number;
    timeline_events: TimelineEvent[];
    retrospective: string;
    retrospective_published_at: number;
    retrospective_was_canceled: boolean;
    retrospective_reminder_interval_seconds: number;
    retrospective_enabled: boolean;
    participant_ids: string[];
    metrics_data: RunMetricData[];

    /** Whether a channel member should be created when a new participant joins the run */
    create_channel_member_on_new_participant: boolean;

    /** Whether a channel member should be removed when an existing participant leaves the run */
    remove_channel_member_on_removed_participant: boolean;

    type: PlaybookRunType
}

export interface StatusPost {
    id: string;
    create_at: number;
    delete_at: number;
}

export interface StatusPostComplete {
    id: string;
    create_at: number;
    delete_at: number;
    message: string;
    author_user_name: string;
}

export interface Metadata {
    channel_name: string;
    channel_display_name: string;
    team_name: string;
    num_participants: number;
    total_posts: number;
    followers: string[];
}

export interface FetchPlaybookRunsReturn {
    total_count: number;
    page_count: number;
    has_more: boolean;
    items: PlaybookRun[];
}

export enum PlaybookRunStatus {
    InProgress = 'InProgress',
    Finished = 'Finished',
}

export interface RunMetricData {
    metric_config_id: string;
    value: number | null;
}

function isString(arg: any): arg is string {
    return Boolean(typeof arg === 'string');
}

export function playbookRunIsActive(playbookRun: PlaybookRun): boolean {
    return playbookRun.current_status === PlaybookRunStatus.InProgress;
}

export interface FetchPlaybookRunsParams {
    page: number;
    per_page: number;
    team_id?: string;
    sort?: string;
    direction?: string;
    statuses?: string[];
    owner_user_id?: string;
    participant_id?: string;
    participant_or_follower_id?: string;
    search_term?: string;
    playbook_id?: string;
    active_gte?: number;
    active_lt?: number;
    started_gte?: number;
    started_lt?: number;
}

export interface FetchPlaybookRunsParamsTime {
    active_gte?: number;
    active_lt?: number;
    started_gte?: number;
    started_lt?: number;
}

export const DefaultFetchPlaybookRunsParamsTime: FetchPlaybookRunsParamsTime = {
    active_gte: 0,
    active_lt: 0,
    started_gte: 0,
    started_lt: 0,
};

export const fetchParamsTimeEqual = (a: FetchPlaybookRunsParams, b: FetchPlaybookRunsParamsTime) => {
    return Boolean(a.active_gte === b.active_gte &&
        a.active_lt === b.active_lt &&
        a.started_gte === b.started_gte &&
        a.started_lt === b.started_lt);
};

// PlaybookRunChecklistItem annotates ChecklistsItem with properties that associate it with the
// containing playbook run.
export interface PlaybookRunChecklistItem extends ChecklistItem {
    item_num: number;
    playbook_run_id: string;
    playbook_run_name: string;
    playbook_run_owner_user_id: string;
    playbook_run_participant_user_ids: string[];
    playbook_run_create_at: number;
    checklist_title: string;
    checklist_num: number;
}
