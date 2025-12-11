// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {findLatestStorageState, loadStorageState} from './auth';
import {printBaselineComparison, printMultiRunSummary} from './baseline';
import {injectCookiesViaCDP, injectLocalStorageViaCDP, preAuthenticateViaCDP} from './chrome';
import {LIGHTHOUSE_FLAGS, METRIC_DEFINITIONS, RESULTS_DIR} from './constants';
import {formatGrade, formatValue, getWebVitalsGrade, logMetricsSection} from './format';
import {calculateStats} from './stats';
import type {LighthouseMetric, MetricsResult, MultiRunSummary, RunResult, StorageState} from './types';
import type {WebVitalsGrade} from './format';

/**
 * Lighthouse runner functions
 */

function ensureResultsDir(): void {
    if (!fs.existsSync(RESULTS_DIR)) {
        fs.mkdirSync(RESULTS_DIR, {recursive: true});
    }
}

/**
 * Warm up the server by making initial requests to eliminate cold start variance.
 * This ensures caches are populated and the server is ready before actual measurements.
 */
async function warmUpServer(url: string, attempts: number = 2): Promise<void> {
    console.log(`\n  Warming up server (${attempts} request${attempts > 1 ? 's' : ''})...`);
    for (let i = 0; i < attempts; i++) {
        try {
            const startTime = Date.now();
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Lighthouse warm-up)',
                },
            });
            const duration = Date.now() - startTime;
            const status = response.ok ? 'OK' : `${response.status}`;
            console.log(`    Warm-up ${i + 1}/${attempts}: ${status} (${duration}ms)`);
            // Small delay between warm-up requests
            if (i < attempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.log(`    Warm-up ${i + 1}/${attempts}: Failed - ${error instanceof Error ? error.message : error}`);
        }
    }
    // Allow server to settle after warm-up
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

function extractAllMetrics(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lhr: any,
    pageId: string,
    url: string,
): MetricsResult {
    const timestamp = new Date().toISOString();
    const performanceScore = Math.round((lhr.categories?.performance?.score || 0) * 100);
    const accessibilityScore = Math.round((lhr.categories?.accessibility?.score || 0) * 100);
    const bestPracticesScore = Math.round((lhr.categories?.['best-practices']?.score || 0) * 100);

    const result: MetricsResult = {
        pageId,
        url,
        timestamp,
        performanceScore,
        accessibilityScore,
        bestPracticesScore,
        metrics: {
            coreWebVitals: [],
            timing: [],
            resources: [],
            diagnostics: [],
        },
        rawAudits: {},
    };

    const audits = lhr.audits || {};
    for (const [auditId, audit] of Object.entries(audits)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = audit as any;

        if (a.numericValue !== undefined || a.score !== undefined) {
            result.rawAudits[auditId] = {
                numericValue: a.numericValue,
                displayValue: a.displayValue,
                score: a.score,
            };
        }

        if (a.numericValue === undefined) continue;

        const def = METRIC_DEFINITIONS[auditId];
        if (!def) continue;

        const metric: LighthouseMetric = {
            id: auditId,
            name: def.name,
            value: a.numericValue,
            displayValue: a.displayValue || formatValue(a.numericValue, def.unit),
            unit: def.unit,
            score: a.score ?? null,
            description: a.description,
        };

        result.metrics[def.category].push(metric);
    }

    return result;
}

export async function runLighthouse(
    url: string,
    pageId: string,
    useAuth: boolean = false,
    needsPreAuth: boolean = false,
    baselineSuffix: string = '',
): Promise<WebVitalsGrade | null> {
    ensureResultsDir();

    const lighthouseModule = await import('lighthouse');
    const lighthouse = lighthouseModule.default;
    const chromeLauncher = await import('chrome-launcher');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Lighthouse: ${pageId}`);
    console.log(`   URL: ${url}`);
    console.log(`${'='.repeat(60)}`);

    // Warm up the server before measurement to reduce cold start variance
    await warmUpServer(url, 1);

    let storageState: StorageState | null = null;
    if (useAuth) {
        const statePath = findLatestStorageState();
        if (statePath) {
            storageState = loadStorageState(statePath);
            console.log(`  Using auth from: ${path.basename(statePath)}`);
        } else {
            console.warn(`  [WARN] No auth session found in storage_state/`);
        }
    }

    console.log(`  Launching Chrome...`);
    const chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
        if (storageState?.cookies?.length) {
            await injectCookiesViaCDP(chrome.port, storageState.cookies);
        }

        if (storageState?.origins?.length) {
            const baseUrl = new URL(url).origin;
            await injectLocalStorageViaCDP(chrome.port, baseUrl, storageState.origins);
        }

        if (needsPreAuth && storageState?.cookies?.length) {
            const baseUrl = new URL(url).origin;
            await preAuthenticateViaCDP(chrome.port, baseUrl);
        }

        const flags = {
            ...LIGHTHOUSE_FLAGS,
            logLevel: 'info' as const,
            port: chrome.port,
        };

        console.log(`  Running Lighthouse on port ${chrome.port}...`);
        const startTime = Date.now();

        const result = await lighthouse(url, flags);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  Completed in ${duration}s`);

        if (!result?.lhr) {
            console.error('  [ERROR] No results from Lighthouse');
            return null;
        }

        const {lhr, report} = result;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reports = Array.isArray(report) ? report : [report];

        const metricsResult = extractAllMetrics(lhr, pageId, url);

        const jsonPath = path.join(RESULTS_DIR, `${pageId}-${timestamp}.json`);
        const htmlPath = path.join(RESULTS_DIR, `${pageId}-${timestamp}.html`);
        const metricsPath = path.join(RESULTS_DIR, `${pageId}-${timestamp}-metrics.json`);

        fs.writeFileSync(jsonPath, reports[0]);
        if (reports[1]) fs.writeFileSync(htmlPath, reports[1]);
        fs.writeFileSync(metricsPath, JSON.stringify(metricsResult, null, 2));

        const latestJsonPath = path.join(RESULTS_DIR, `${pageId}-latest.json`);
        const latestHtmlPath = path.join(RESULTS_DIR, `${pageId}-latest.html`);
        const latestMetricsPath = path.join(RESULTS_DIR, `${pageId}-latest-metrics.json`);
        try {
            if (fs.existsSync(latestJsonPath)) fs.unlinkSync(latestJsonPath);
            if (fs.existsSync(latestHtmlPath)) fs.unlinkSync(latestHtmlPath);
            if (fs.existsSync(latestMetricsPath)) fs.unlinkSync(latestMetricsPath);
            fs.symlinkSync(path.basename(jsonPath), latestJsonPath);
            fs.symlinkSync(path.basename(htmlPath), latestHtmlPath);
            fs.symlinkSync(path.basename(metricsPath), latestMetricsPath);
        } catch {
            // Symlinks may fail on Windows
        }

        console.log(`\n LIGHTHOUSE SCORES:`);
        console.log(`  Performance:     ${metricsResult.performanceScore}/100`);
        console.log(`  Accessibility:   ${metricsResult.accessibilityScore}/100`);
        console.log(`  Best Practices:  ${metricsResult.bestPracticesScore}/100`);

        logMetricsSection('Core Web Vitals', metricsResult.metrics.coreWebVitals);
        logMetricsSection('Timing Metrics', metricsResult.metrics.timing);
        logMetricsSection('Resource Metrics', metricsResult.metrics.resources);
        logMetricsSection('Diagnostics', metricsResult.metrics.diagnostics);

        // Web Vitals grade
        const audits = metricsResult.rawAudits;
        const grade = getWebVitalsGrade({
            lcp: audits['largest-contentful-paint']?.numericValue || 0,
            tbt: audits['total-blocking-time']?.numericValue || 0,
            cls: audits['cumulative-layout-shift']?.numericValue || 0,
            fcp: audits['first-contentful-paint']?.numericValue || 0,
            si: audits['speed-index']?.numericValue || 0,
            tti: audits['interactive']?.numericValue || 0,
        });
        console.log(`\n ${formatGrade(grade)}`);

        printBaselineComparison(pageId, metricsResult, baselineSuffix);

        const totalMetrics =
            metricsResult.metrics.coreWebVitals.length +
            metricsResult.metrics.timing.length +
            metricsResult.metrics.resources.length +
            metricsResult.metrics.diagnostics.length;

        console.log(`\n Reports (${totalMetrics} metrics collected):`);
        console.log(`  HTML:    file://${htmlPath}`);
        console.log(`  JSON:    file://${jsonPath}`);
        console.log(`  Metrics: file://${metricsPath}`);

        return grade;
    } finally {
        await chrome.kill();
    }
}

async function runLighthouseSingleAndReturn(
    url: string,
    pageId: string,
    runNumber: number,
    useAuth: boolean = false,
    needsPreAuth: boolean = false,
): Promise<RunResult | null> {
    ensureResultsDir();

    const lighthouseModule = await import('lighthouse');
    const lighthouse = lighthouseModule.default;
    const chromeLauncher = await import('chrome-launcher');

    let storageState: StorageState | null = null;
    if (useAuth) {
        const statePath = findLatestStorageState();
        if (statePath) {
            storageState = loadStorageState(statePath);
        }
    }

    const chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
        if (storageState?.cookies?.length) {
            await injectCookiesViaCDP(chrome.port, storageState.cookies);
        }

        if (storageState?.origins?.length) {
            const baseUrl = new URL(url).origin;
            await injectLocalStorageViaCDP(chrome.port, baseUrl, storageState.origins);
        }

        if (needsPreAuth && storageState?.cookies?.length) {
            const baseUrl = new URL(url).origin;
            await preAuthenticateViaCDP(chrome.port, baseUrl);
        }

        const flags = {
            ...LIGHTHOUSE_FLAGS,
            logLevel: 'error' as const,
            port: chrome.port,
        };

        const result = await lighthouse(url, flags);

        if (!result?.lhr) {
            return null;
        }

        const lhr = result.lhr;
        const audits = lhr.audits || {};
        const timestamp = new Date().toISOString();

        let htmlReportPath: string | undefined;
        if (result.report) {
            const reports = Array.isArray(result.report) ? result.report : [result.report];
            const htmlReport = reports[1];
            if (htmlReport) {
                const htmlFileName = `${pageId}-run${runNumber}-${timestamp.replace(/[:.]/g, '-')}.html`;
                htmlReportPath = path.join(RESULTS_DIR, htmlFileName);
                fs.writeFileSync(htmlReportPath, htmlReport);
            }
        }

        return {
            runNumber,
            timestamp,
            performanceScore: Math.round((lhr.categories?.performance?.score || 0) * 100),
            accessibilityScore: Math.round((lhr.categories?.accessibility?.score || 0) * 100),
            bestPracticesScore: Math.round((lhr.categories?.['best-practices']?.score || 0) * 100),
            lcp: audits['largest-contentful-paint']?.numericValue || 0,
            tbt: audits['total-blocking-time']?.numericValue || 0,
            cls: audits['cumulative-layout-shift']?.numericValue || 0,
            fcp: audits['first-contentful-paint']?.numericValue || 0,
            si: audits['speed-index']?.numericValue || 0,
            tti: audits['interactive']?.numericValue || 0,
            ttfb: audits['server-response-time']?.numericValue || 0,
            maxFid: audits['max-potential-fid']?.numericValue || 0,
            totalByteWeight: audits['total-byte-weight']?.numericValue || 0,
            mainThreadWork: audits['mainthread-work-breakdown']?.numericValue || 0,
            bootupTime: audits['bootup-time']?.numericValue || 0,
            htmlReportPath,
        };
    } finally {
        await chrome.kill();
    }
}

/**
 * Get Web Vitals grade from a MultiRunSummary using median values
 */
export function getGradeFromSummary(summary: MultiRunSummary): WebVitalsGrade {
    return getWebVitalsGrade({
        lcp: summary.stats.lcp.median,
        tbt: summary.stats.tbt.median,
        cls: summary.stats.cls.median,
        fcp: summary.stats.fcp.median,
        si: summary.stats.si.median,
        tti: summary.stats.tti.median,
    });
}

export async function runLighthouseMultiple(
    url: string,
    pageId: string,
    numRuns: number,
    useAuth: boolean = false,
    needsPreAuth: boolean = false,
    baselineSuffix: string = '',
): Promise<{summary: MultiRunSummary; grade: WebVitalsGrade} | null> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Multi-Run Lighthouse: ${pageId} (${numRuns} iterations)`);
    console.log(`   URL: ${url}`);
    console.log(`${'='.repeat(70)}`);

    // Warm up the server before actual measurements to reduce cold start variance
    await warmUpServer(url);

    const runs: RunResult[] = [];

    for (let i = 1; i <= numRuns; i++) {
        console.log(`\n  Run ${i}/${numRuns}...`);
        const startTime = Date.now();

        try {
            const result = await runLighthouseSingleAndReturn(url, pageId, i, useAuth, needsPreAuth);
            if (result) {
                runs.push(result);
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(
                    `    Perf: ${result.performanceScore}, LCP: ${(result.lcp / 1000).toFixed(2)}s, TBT: ${result.tbt}ms (${duration}s)`,
                );
                if (result.htmlReportPath) {
                    console.log(`    Report: file://${result.htmlReportPath}`);
                }
            } else {
                console.log(`    [WARN] Run ${i} returned no results`);
            }
        } catch (error) {
            console.error(`    [ERROR] Run ${i} failed: ${error instanceof Error ? error.message : error}`);
        }

        if (i < numRuns) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    if (runs.length === 0) {
        console.error(`\n  [ERROR] All ${numRuns} runs failed for ${pageId}`);
        return null;
    }

    const summary: MultiRunSummary = {
        pageId,
        url,
        runs,
        stats: {
            performanceScore: calculateStats(runs.map((r) => r.performanceScore)),
            accessibilityScore: calculateStats(runs.map((r) => r.accessibilityScore)),
            bestPracticesScore: calculateStats(runs.map((r) => r.bestPracticesScore)),
            lcp: calculateStats(runs.map((r) => r.lcp)),
            tbt: calculateStats(runs.map((r) => r.tbt)),
            cls: calculateStats(runs.map((r) => r.cls)),
            fcp: calculateStats(runs.map((r) => r.fcp)),
            si: calculateStats(runs.map((r) => r.si)),
            tti: calculateStats(runs.map((r) => r.tti)),
            ttfb: calculateStats(runs.map((r) => r.ttfb)),
            maxFid: calculateStats(runs.map((r) => r.maxFid)),
            totalByteWeight: calculateStats(runs.map((r) => r.totalByteWeight)),
            mainThreadWork: calculateStats(runs.map((r) => r.mainThreadWork)),
            bootupTime: calculateStats(runs.map((r) => r.bootupTime)),
        },
    };

    printMultiRunSummary(summary, baselineSuffix);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summaryPath = path.join(RESULTS_DIR, `${pageId}-multirun-${timestamp}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`\n  Summary: file://${summaryPath}`);

    const grade = getGradeFromSummary(summary);
    return {summary, grade};
}
