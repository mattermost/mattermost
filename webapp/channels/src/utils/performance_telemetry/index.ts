// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const enum Mark {
    ChannelLinkClicked = 'SidebarChannelLink#click',
    GlobalThreadsLinkClicked = 'GlobalThreadsLink#click',
    PostListLoaded = 'PostList#component',
    PostSelected = 'PostList#postSelected',
    TeamLinkClicked = 'TeamLink#click',
}

export const enum Measure {
    ChannelSwitch = 'channel_switch',
    GlobalThreadsLoad = 'global_threads_load',
    PageLoad = 'page_load',
    TTFB = 'TTFB',
    TTLB = 'TTLB',
    SplashScreen = 'splash_screen',
    DomInteractive = 'dom_interactive',
    RhsLoad = 'rhs_load',
    TeamSwitch = 'team_switch',
}

export function markAndReport(name: string): PerformanceMark {
    return performance.mark(name, {
        detail: {
            report: true,
        },
    });
}

/**
 * Measures the duration between two performance marks, schedules it to be reported to the server, and returns the
 * PerformanceMeasure created by doing this. If endMark is omitted, the measure will measure the duration until now.
 *
 * If either the start or end mark does not exist, undefined will be returned, and if canFail is false, an error
 * will be logged.
 */
export function measureAndReport({
    name,
    startMark,
    endMark,
    labels,
    canFail = false,
}: {
    name: string;
    startMark: string | DOMHighResTimeStamp;
    endMark?: string | DOMHighResTimeStamp;
    labels?: Record<string, string>;
    canFail?: boolean;
}): PerformanceMeasure | undefined {
    const options: PerformanceMeasureOptions = {
        start: startMark,
        end: endMark,
        detail: {
            labels,
            report: true,
        },
    };

    try {
        return performance.measure(name, options);
    } catch (e) {
        if (!canFail) {
            // eslint-disable-next-line no-console
            console.error('Unable to measure ' + name, e);
        }

        return undefined;
    }
}
