// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface SiteStats {
    total_playbook_runs: number;
    total_playbooks: number;
}

export type NullNumber = number | null;

export interface PlaybookStats {
    runs_in_progress: number;
    participants_active: number;
    runs_finished_prev_30_days: number;
    runs_finished_percentage_change: number;
    runs_started_per_week: number[];
    runs_started_per_week_times: number[][];
    active_runs_per_day: number[];
    active_runs_per_day_times: number[][];
    active_participants_per_day: number[];
    active_participants_per_day_times: number[][];
    metric_overall_average: NullNumber[]; // indexed by metric, in the same order as playbook.metrics
    metric_rolling_average: NullNumber[]; // indexed by metric
    metric_rolling_average_change: NullNumber[];
    metric_value_range: NullNumber[][]; // indexed by metric, each array is a tuple: min max
    metric_rolling_values: NullNumber[][]; // indexed by metric, each array is that metric's last x runs values (reverse order: 0: most recent, 1: second most recent, etc.)
    last_x_run_names: string[];
}

export const EmptyPlaybookStats = {
    runs_in_progress: 0,
    participants_active: 0,
    runs_finished_prev_30_days: 0,
    runs_finished_percentage_change: 0,
    runs_started_per_week: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    runs_started_per_week_times: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    active_runs_per_day: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    active_runs_per_day_times: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    active_participants_per_day: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    active_participants_per_day_times: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    metric_overall_average: [0, 0, 0, 0],
    metric_rolling_average: [0, 0, 0, 0],
    metric_rolling_average_change: [0, 0, 0, 0],
    metric_value_range: [[0, 0], [0, 0], [0, 0], [0, 0]],
    metric_rolling_values: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    last_x_run_names: ['', '', '', '', '', '', '', '', '', ''],
} as PlaybookStats;
