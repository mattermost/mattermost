// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WEB_VITALS_THRESHOLDS} from './constants';
import type {
    BaselineMetric,
    ComparisonStatus,
    LighthouseMetric,
    MachineInfo,
    ServerInfo,
    StatisticalSummary,
} from './types';

/**
 * Formatting and display functions
 */

export function formatValue(value: number, unit: LighthouseMetric['unit']): string {
    switch (unit) {
        case 'ms':
            return `${Math.round(value)} ms`;
        case 'bytes':
            if (value >= 1024 * 1024) {
                return `${(value / (1024 * 1024)).toFixed(2)} MB`;
            } else if (value >= 1024) {
                return `${(value / 1024).toFixed(1)} KB`;
            }
            return `${Math.round(value)} B`;
        case 'ratio':
            return value.toFixed(3);
        case 'count':
            return value.toLocaleString();
        default:
            return String(value);
    }
}

export function formatMachineInfo(machine: MachineInfo): string {
    const platformNames: Record<string, string> = {
        darwin: 'macOS',
        linux: 'Linux',
        win32: 'Windows',
    };
    const platformName = platformNames[machine.platform] || machine.platform;
    return `${platformName} ${machine.arch}, ${machine.cpuCores} cores, ${machine.totalMemoryGB}GB RAM`;
}

export function formatServerInfo(server: ServerInfo): string {
    const enterprise = server.buildEnterpriseReady ? 'Enterprise' : 'Team';
    const docker = server.dockerImageTag ? ` (${server.dockerImageTag})` : '';
    return `v${server.version} ${enterprise} (build ${server.buildNumber})${docker}`;
}

export function formatMs(stat: StatisticalSummary): string {
    return `${stat.median.toFixed(0)}ms ± ${stat.stdDev.toFixed(0)}ms [${stat.min.toFixed(0)} - ${stat.max.toFixed(0)}]`;
}

export function formatSec(stat: StatisticalSummary): string {
    return `${(stat.median / 1000).toFixed(2)}s ± ${(stat.stdDev / 1000).toFixed(2)}s [${(stat.min / 1000).toFixed(2)} - ${(stat.max / 1000).toFixed(2)}]`;
}

export function formatBytes(stat: StatisticalSummary): string {
    const toKiB = (v: number) => (v / 1024).toFixed(0);
    return `${toKiB(stat.median)} KiB ± ${toKiB(stat.stdDev)} KiB [${toKiB(stat.min)} - ${toKiB(stat.max)}]`;
}

export function getStatusIcon(score: number | null, value: number, unit: string): string {
    if (unit === 'ms' && value > 30000) {
        return '[TIMEOUT]';
    }
    if (score === null) return '[-]';
    if (score >= 0.9) return '✓';
    if (score >= 0.5) return '⚠';
    return 'X';
}

export function getStatusSymbol(status: ComparisonStatus): string {
    switch (status) {
        case 'improved':
            return '↑';
        case 'acceptable':
            return '=';
        case 'warning':
            return '!';
        case 'regressed':
        case 'failed':
            return '↓';
    }
}

export function getPassFailPrefix(status: ComparisonStatus): string {
    switch (status) {
        case 'regressed':
        case 'failed':
            return '[FAIL]';
        case 'improved':
        case 'acceptable':
        case 'warning':
            return '[PASS]';
    }
}

/**
 * Calculate how many standard deviations the current value is from baseline median
 * When stdDev is 0, use percentage-based thresholds instead
 */
export function getStdDevDistance(current: number, baseline: BaselineMetric, lowerIsBetter: boolean): number {
    const delta = current - baseline.median;

    // When stdDev is 0 (all baseline runs had identical values), use percentage-based comparison
    if (baseline.stdDev === 0) {
        if (Math.abs(delta) < 0.01) return 0; // Equal to baseline

        // Map percentage directly to stdDev-like scale:
        // - 2% change = warning (stdDev ~2.5)
        // - 3% change = regressed (stdDev ~3.5)
        // - 5%+ change = failed (stdDev >4)
        const percentChange = baseline.median !== 0 ? Math.abs(delta / baseline.median) * 100 : 100;
        const direction = lowerIsBetter ? (delta > 0 ? 1 : -1) : delta < 0 ? 1 : -1;

        // Scale: 1% = 1.25 stdDev, so 3% ≈ 3.75 (regressed), 4% ≈ 5 (failed)
        return direction * (percentChange * 1.25);
    }

    return lowerIsBetter ? delta / baseline.stdDev : -delta / baseline.stdDev;
}

/**
 * Check if a metric value exceeds Web Vitals thresholds
 */
export function checkWebVitalsThreshold(metricId: string, value: number): 'good' | 'warning' | 'failed' | null {
    const threshold = WEB_VITALS_THRESHOLDS[metricId as keyof typeof WEB_VITALS_THRESHOLDS];
    if (!threshold) return null;

    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'warning';
    return 'failed';
}

export type GradeStatus = 'good' | 'needs-improvement' | 'poor';

export interface MetricGrade {
    id: string;
    name: string;
    value: number;
    status: GradeStatus;
    goodThreshold: number;
    poorThreshold: number;
}

export interface WebVitalsGrade {
    overall: 'PASS' | 'WARN' | 'FAIL';
    metrics: MetricGrade[];
}

/**
 * Check all Web Vitals metrics and return overall grade
 * PASS = All Good, WARN = Some Needs Improvement, FAIL = Any Poor
 */
export function getWebVitalsGrade(metrics: {
    lcp: number;
    tbt: number;
    cls: number;
    fcp: number;
    si: number;
    tti: number;
}): WebVitalsGrade {
    const checks: {id: keyof typeof WEB_VITALS_THRESHOLDS; name: string; value: number}[] = [
        {id: 'lcp', name: 'LCP', value: metrics.lcp},
        {id: 'tbt', name: 'TBT', value: metrics.tbt},
        {id: 'cls', name: 'CLS', value: metrics.cls},
        {id: 'fcp', name: 'FCP', value: metrics.fcp},
        {id: 'si', name: 'SI', value: metrics.si},
        {id: 'tti', name: 'TTI', value: metrics.tti},
    ];

    const graded: MetricGrade[] = checks.map((check) => {
        const threshold = WEB_VITALS_THRESHOLDS[check.id];
        let status: GradeStatus;
        if (check.value <= threshold.good) {
            status = 'good';
        } else if (check.value <= threshold.needsImprovement) {
            status = 'needs-improvement';
        } else {
            status = 'poor';
        }
        return {
            id: check.id,
            name: check.name,
            value: check.value,
            status,
            goodThreshold: threshold.good,
            poorThreshold: threshold.needsImprovement,
        };
    });

    const hasPoor = graded.some((m) => m.status === 'poor');
    const hasNeedsImprovement = graded.some((m) => m.status === 'needs-improvement');

    let overall: 'PASS' | 'WARN' | 'FAIL';
    if (hasPoor) {
        overall = 'FAIL';
    } else if (hasNeedsImprovement) {
        overall = 'WARN';
    } else {
        overall = 'PASS';
    }

    return {overall, metrics: graded};
}

/**
 * Format the grade for display - shows all metrics with their status
 */
export function formatGrade(grade: WebVitalsGrade): string {
    const lines: string[] = [];
    lines.push(`Web Vitals Grade: [${grade.overall}]`);

    for (const m of grade.metrics) {
        let statusLabel: string;
        if (m.status === 'good') {
            statusLabel = 'good';
        } else if (m.status === 'needs-improvement') {
            statusLabel = 'needs improvement';
        } else {
            statusLabel = 'poor';
        }

        let valueStr: string;
        if (m.id === 'cls') {
            valueStr = m.value.toFixed(3);
        } else {
            valueStr = `${(m.value / 1000).toFixed(2)}s`;
        }

        lines.push(`  ${m.name}: ${valueStr} (${statusLabel})`);
    }

    return lines.join('\n');
}

/**
 * Compare result status based on statistical bounds and Web Vitals thresholds
 */
export function getComparisonStatus(
    current: number,
    baseline: BaselineMetric,
    lowerIsBetter: boolean,
    metricId?: string,
): ComparisonStatus {
    const stdDevDistance = getStdDevDistance(current, baseline, lowerIsBetter);

    let webVitalsStatus: 'good' | 'warning' | 'failed' | null = null;
    if (metricId) {
        webVitalsStatus = checkWebVitalsThreshold(metricId, current);
    }

    let statisticalStatus: ComparisonStatus;
    if (stdDevDistance <= -2) {
        statisticalStatus = 'improved';
    } else if (stdDevDistance <= 2) {
        statisticalStatus = 'acceptable';
    } else if (stdDevDistance <= 3) {
        statisticalStatus = 'warning';
    } else {
        statisticalStatus = 'regressed';
    }

    // Web Vitals "failed" (Poor threshold) takes precedence
    if (webVitalsStatus === 'failed') return 'failed';
    if (statisticalStatus === 'regressed') return 'regressed';
    if (webVitalsStatus === 'warning' || statisticalStatus === 'warning') return 'warning';
    if (statisticalStatus === 'improved') return 'improved';
    return 'acceptable';
}

/**
 * Format a delta value with direction indicator and statistical significance
 * Returns format: ", ↑ +0.48s (+63.7%)" or "(= baseline)"
 */
export function formatDeltaWithBounds(
    current: number,
    baseline: BaselineMetric,
    lowerIsBetter: boolean,
    unit: string = '',
    metricId?: string,
): string {
    const delta = current - baseline.median;
    const percent = baseline.median !== 0 ? ((delta / baseline.median) * 100).toFixed(1) : '∞';

    if (Math.abs(delta) < 0.01) {
        return ' (= baseline)';
    }

    const arrow = delta > 0 ? '↑' : '↓';
    const sign = delta > 0 ? '+' : '';

    if (unit === 'ms') {
        return `, ${arrow} ${sign}${delta.toFixed(0)}${unit} (${sign}${percent}%)`;
    } else if (unit === 's') {
        return `, ${arrow} ${sign}${(delta / 1000).toFixed(2)}${unit} (${sign}${percent}%)`;
    } else if (unit === 'KiB') {
        return `, ${arrow} ${sign}${(delta / 1024).toFixed(0)}${unit} (${sign}${percent}%)`;
    } else if (unit === 'score') {
        return `, ${arrow} ${sign}${delta.toFixed(0)} pts (${sign}${percent}%)`;
    } else {
        return `, ${arrow} ${sign}${delta.toFixed(3)} (${sign}${percent}%)`;
    }
}

export interface ComparisonResult {
    prefix: string;
    symbol: string;
    comparison: string;
    status: ComparisonStatus;
}

export function getComparisonWithStatus(
    current: number,
    baseline: BaselineMetric,
    lowerIsBetter: boolean,
    unit: string,
    metricId?: string,
): ComparisonResult {
    const status = getComparisonStatus(current, baseline, lowerIsBetter, metricId);
    const comparison = formatDeltaWithBounds(current, baseline, lowerIsBetter, unit, metricId);
    return {
        prefix: getPassFailPrefix(status),
        symbol: getStatusSymbol(status),
        comparison,
        status,
    };
}

export function formatBaselineValue(baseline: BaselineMetric, unit: string): string {
    const median = baseline.median;
    if (unit === 's') {
        return `${(median / 1000).toFixed(2)}s [${(baseline.lowerBound / 1000).toFixed(2)}-${(baseline.upperBound / 1000).toFixed(2)}]`;
    } else if (unit === 'ms') {
        return `${median.toFixed(0)}ms [${baseline.lowerBound.toFixed(0)}-${baseline.upperBound.toFixed(0)}]`;
    } else if (unit === 'KiB') {
        return `${(median / 1024).toFixed(0)} KiB [${(baseline.lowerBound / 1024).toFixed(0)}-${(baseline.upperBound / 1024).toFixed(0)}]`;
    } else if (unit === 'score') {
        return `${median} [${baseline.lowerBound.toFixed(0)}-${baseline.upperBound.toFixed(0)}]`;
    } else {
        return `${median.toFixed(3)} [${baseline.lowerBound.toFixed(3)}-${baseline.upperBound.toFixed(3)}]`;
    }
}

/**
 * Format metric value consistently (seconds with 2 decimal places for timing)
 */
export function formatMetricValue(value: number, unit: LighthouseMetric['unit']): string {
    switch (unit) {
        case 'ms':
            return `${(value / 1000).toFixed(2)}s`;
        case 'bytes':
            if (value >= 1024 * 1024) {
                return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
            } else if (value >= 1024) {
                return `${(value / 1024).toFixed(0)} KiB`;
            }
            return `${Math.round(value)} B`;
        case 'ratio':
            return value.toFixed(3);
        case 'count':
            return value.toLocaleString();
        default:
            return String(value);
    }
}

export function logMetricsSection(title: string, metrics: LighthouseMetric[]): void {
    if (metrics.length === 0) return;

    console.log(`\n ${title}:`);
    for (const m of metrics) {
        const icon = getStatusIcon(m.score, m.value, m.unit);
        const scoreStr = m.score !== null ? ` (${Math.round(m.score * 100)})` : '';
        const timeout = m.unit === 'ms' && m.value > 30000 ? ' [timeout]' : '';
        const formattedValue = formatMetricValue(m.value, m.unit);
        console.log(`  ${icon} ${m.name.padEnd(35)}: ${formattedValue}${scoreStr}${timeout}`);
    }
}
