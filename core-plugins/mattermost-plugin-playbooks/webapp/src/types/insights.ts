// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Insights {
    playbook_id: string;
    num_runs: number;
    title: string;
    last_run_at: number;
}

export interface InsightsResponse {
    has_next: boolean;
    items: Insights[];
}
