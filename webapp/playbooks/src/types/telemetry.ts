// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Telemetry migration is in-progress
// If you need to check the old
// Event/Telemetry inventory available at https://docs.google.com/spreadsheets/d/15VBD2i-v7JX11H80beJj64wU8lqyMAm1UrDIjKjx63o/edit#gid=374475626

export enum GeneralViewTarget {
    TaskInbox = 'task_inbox',
    ChannelsRHSHome = 'channels_rhs_home',
    ChannelsRHSRunList = 'channels_rhs_runlist',
}

export enum PlaybookViewTarget {
    Usage = 'view_playbook_usage',
    Outline = 'view_playbook_outline',
    Reports = 'view_playbook_reports'
}

export enum PlaybookRunViewTarget {

    ChannelsRHSDetails = 'channels_rhs_rundetails',

    // StatusUpdate is triggered any time a StatusUpdatePost is shown in a
    // channel, so we track impressions
    StatusUpdate = 'run_status_update',

    // Details is triggered when new RDP is shown
    Details = 'run_details', // old name: "view_run_details"
}

export enum PlaybookRunEventTarget {
    RequestUpdateClick = 'playbookrun_request_update',
    Participate = 'playbookrun_participate',
    Create = 'playbookrun_create',
    Leave = 'playbookrun_leave',
    Follow = 'playbookrun_follow',
    Unfollow = 'playbookrun_unfollow',
    UpdateActions = 'playbookrun_update_actions',
}

export enum TaskActionsEventTarget {
    UpdateActions = 'taskactions_updated',
    Triggered = 'taskactions_triggered',
    ActionExecuted = 'taskactions_action_executed',
}

export type TelemetryViewTarget = GeneralViewTarget | PlaybookViewTarget | PlaybookRunViewTarget;
export type TelemetryEventTarget = PlaybookRunEventTarget | TaskActionsEventTarget;
