// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Note: Adapted from mattermost/webapp/channels/src/utils/performance_telemetry/index.ts.
// The Mattermost repo doesn't expose this functionality to plugins, so it's duplicated here.
// If it becomes available as a public import, this file can be removed.

/**
 * The single metric name sent to the server for all plugin performance measures.
 * The actual action being measured is sent via labels.action.
 * This allows the server to handle all plugin metrics with a single known metric type.
 */
const PLUGIN_PERF_METRIC = 'plugin_webapp_perf';

/**
 * Plugin identifier sent with all metrics to distinguish playbooks from other plugins.
 */
const PLUGIN_ID = 'playbooks';

/**
 * Mark names for playbooks performance telemetry.
 * Marks are used to record a point in time (e.g., when a user clicks a link).
 */
export const Mark = {
    PlaybooksLHSButtonClicked: 'PlaybooksLHS#buttonClicked',
    PlaybookRunsLHSButtonClicked: 'PlaybookRunsLHS#buttonClicked',
};

/**
 * Measure names for playbooks performance telemetry.
 * Measures record durations between two marks or from a mark to now.
 * These values are sent as labels.plugin_metric_label in the metric.
 */
export const Measure = {
    PlaybooksListLoadDurationMs: 'playbooks_list_load_duration_ms',
    PlaybookRunsListLoadDurationMs: 'playbook_runs_list_load_duration_ms',
};

/**
 * Creates a performance mark that will be reported to the server.
 * The mark will be caught by Mattermost's webapp PerformanceObserver.
 */
export function mark(name: string): PerformanceMark {
    return performance.mark(name, {
        detail: {
            report: true,
        },
    });
}

/**
 * Measures the duration between two performance marks and reports it to the server
 * via Mattermost's Webapp Performance Observer.
 *
 * The metric is sent as "plugin_webapp_perf" with labels:
 *   - plugin_id: "playbooks"
 *   - plugin_metric_label: the name parameter (e.g., "list_load", "runs_list_load")
 *
 * If endMark is omitted, the measure will measure the duration until now.
 * If the start mark does not exist and canFail is false, an error will be logged.
 */
export function measureAndReport({
    name,
    startMark,
    endMark,
    canFail = false,
}: {
    name: string;
    startMark: string;
    endMark?: string;
    canFail?: boolean;
}): PerformanceMeasure | undefined {
    const options: PerformanceMeasureOptions = {
        start: startMark,
        end: endMark,
        detail: {
            report: true,
            labels: {
                plugin_id: PLUGIN_ID,
                plugin_metric_label: name,
            },
        },
    };

    try {
        return performance.measure(PLUGIN_PERF_METRIC, options);
    } catch (e) {
        if (!canFail) {
            // eslint-disable-next-line no-console
            console.error('Playbooks: Unable to measure ' + name, e);
        }

        return undefined;
    }
}
