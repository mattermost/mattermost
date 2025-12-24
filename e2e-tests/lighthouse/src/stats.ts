// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {StatisticalSummary} from './types';

/**
 * Statistical calculation functions for multi-run analysis
 */

function calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

function calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function findOutliers(values: number[], mean: number, stdDev: number): number[] {
    if (stdDev === 0) return [];
    const threshold = 2;
    return values.filter((v) => Math.abs(v - mean) > threshold * stdDev);
}

export function calculateStats(values: number[]): StatisticalSummary {
    const mean = calculateMean(values);
    const stdDev = calculateStdDev(values, mean);
    return {
        count: values.length,
        mean: Math.round(mean * 100) / 100,
        median: Math.round(calculateMedian(values) * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        min: Math.round(Math.min(...values) * 100) / 100,
        max: Math.round(Math.max(...values) * 100) / 100,
        p75: Math.round(calculatePercentile(values, 75) * 100) / 100,
        p90: Math.round(calculatePercentile(values, 90) * 100) / 100,
        p95: Math.round(calculatePercentile(values, 95) * 100) / 100,
        cv: mean !== 0 ? Math.round((stdDev / mean) * 100 * 100) / 100 : 0,
        outliers: findOutliers(values, mean, stdDev),
    };
}
