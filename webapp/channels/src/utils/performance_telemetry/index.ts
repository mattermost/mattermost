// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function markAndReport(name: string): PerformanceMark {
    return performance.mark(name, {
        detail: {
            report: true,
        },
    });
}

export function measureAndReport(measureName: string, startMark: string, endMark: string): PerformanceMeasure | undefined {
    const options: PerformanceMeasureOptions = {
        start: startMark,
        end: endMark,
        detail: {
            report: true,
        },
    };

    try {
        return performance.measure(measureName, options);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Unable to measure ' + measureName, e);

        return undefined;
    }
}
