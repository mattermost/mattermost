// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Type definitions for Web Vitals with Lighthouse
 */

export interface LighthouseMetric {
    id: string;
    name: string;
    value: number;
    displayValue: string;
    unit: 'ms' | 'bytes' | 'ratio' | 'count' | 'unitless';
    score: number | null;
    description?: string;
}

export interface MetricsResult {
    pageId: string;
    url: string;
    timestamp: string;
    performanceScore: number;
    accessibilityScore: number;
    bestPracticesScore: number;
    metrics: {
        coreWebVitals: LighthouseMetric[];
        timing: LighthouseMetric[];
        resources: LighthouseMetric[];
        diagnostics: LighthouseMetric[];
    };
    rawAudits: Record<string, {numericValue?: number; displayValue?: string; score?: number | null}>;
}

export interface StorageState {
    cookies: Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
        expires?: number;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: 'Strict' | 'Lax' | 'None';
    }>;
    origins?: Array<{
        origin: string;
        localStorage: Array<{
            name: string;
            value: string;
        }>;
    }>;
}

export interface RunResult {
    runNumber: number;
    timestamp: string;
    performanceScore: number;
    accessibilityScore: number;
    bestPracticesScore: number;
    lcp: number;
    tbt: number;
    cls: number;
    fcp: number;
    si: number;
    tti: number;
    ttfb: number;
    maxFid: number;
    totalByteWeight: number;
    mainThreadWork: number;
    bootupTime: number;
    htmlReportPath?: string;
}

export interface StatisticalSummary {
    count: number;
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    p75: number;
    p90: number;
    p95: number;
    cv: number;
    outliers: number[];
}

export interface MultiRunSummary {
    pageId: string;
    url: string;
    runs: RunResult[];
    stats: {
        performanceScore: StatisticalSummary;
        accessibilityScore: StatisticalSummary;
        bestPracticesScore: StatisticalSummary;
        lcp: StatisticalSummary;
        tbt: StatisticalSummary;
        cls: StatisticalSummary;
        fcp: StatisticalSummary;
        si: StatisticalSummary;
        tti: StatisticalSummary;
        ttfb: StatisticalSummary;
        maxFid: StatisticalSummary;
        totalByteWeight: StatisticalSummary;
        mainThreadWork: StatisticalSummary;
        bootupTime: StatisticalSummary;
    };
}

export interface BaselineMetric {
    median: number;
    stdDev: number;
    cv: number;
    min: number;
    max: number;
    lowerBound: number;
    upperBound: number;
}

export interface MachineInfo {
    platform: string;
    arch: string;
    osRelease: string;
    cpuModel: string;
    cpuCores: number;
    totalMemoryGB: number;
    nodeVersion: string;
}

export interface ServerInfo {
    version: string;
    buildNumber: string;
    buildDate: string;
    buildHash: string;
    buildHashEnterprise: string;
    buildEnterpriseReady: boolean;
    siteUrl: string;
    dockerImageTag?: string;
}

export interface LighthouseBaseline {
    version: string;
    createdAt: string;
    runsPerPage: number;
    machine: MachineInfo;
    server?: ServerInfo;
    pages: {
        [pageId: string]: {
            url: string;
            performanceScore: BaselineMetric;
            accessibilityScore: BaselineMetric;
            bestPracticesScore: BaselineMetric;
            lcp: BaselineMetric;
            tbt: BaselineMetric;
            cls: BaselineMetric;
            fcp: BaselineMetric;
            si: BaselineMetric;
            tti: BaselineMetric;
            ttfb: BaselineMetric;
            maxFid: BaselineMetric;
            totalByteWeight: BaselineMetric;
            mainThreadWork: BaselineMetric;
            bootupTime: BaselineMetric;
        };
    };
}

export type ComparisonStatus = 'improved' | 'acceptable' | 'warning' | 'regressed' | 'failed';

export interface PageConfig {
    id: string;
    url: string;
    auth: boolean;
    needsPreAuth?: boolean;
}
