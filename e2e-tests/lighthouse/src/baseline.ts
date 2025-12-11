// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import {fileURLToPath} from 'url';

import {BASELINE_DIR, LATEST_BASELINE_FILE, RESULTS_DIR} from './constants';
import {
    formatBaselineValue,
    formatBytes,
    formatGrade,
    formatMachineInfo,
    formatMs,
    formatSec,
    formatServerInfo,
    getComparisonWithStatus,
    getWebVitalsGrade,
} from './format';
import type {
    BaselineMetric,
    LighthouseBaseline,
    MachineInfo,
    MetricsResult,
    MultiRunSummary,
    ServerInfo,
    StatisticalSummary,
} from './types';

// Read version from package.json for baseline versioning
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
const BASELINE_VERSION = packageJson.version;

/**
 * Baseline management functions
 */

export function loadBaseline(): LighthouseBaseline | null {
    if (!fs.existsSync(LATEST_BASELINE_FILE)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(LATEST_BASELINE_FILE, 'utf-8'));
    } catch {
        return null;
    }
}

function loadBaselineFromFile(filePath: string): LighthouseBaseline | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

export function getMachineInfo(): MachineInfo {
    const cpus = os.cpus();
    return {
        platform: os.platform(),
        arch: os.arch(),
        osRelease: os.release(),
        cpuModel: cpus[0]?.model || 'Unknown',
        cpuCores: cpus.length,
        totalMemoryGB: Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10,
        nodeVersion: process.version,
    };
}

export async function getServerInfo(baseUrl: string): Promise<ServerInfo | null> {
    try {
        const response = await fetch(`${baseUrl}/api/v4/config/client?format=old`);
        if (!response.ok) {
            console.warn(`  [WARN] Could not fetch server info: ${response.status}`);
            return null;
        }
        const config = (await response.json()) as Record<string, string>;

        const dockerImageTag = process.env.DOCKER_IMAGE_TAG || process.env.MM_DOCKER_IMAGE || undefined;

        return {
            version: config.Version || 'unknown',
            buildNumber: config.BuildNumber || 'unknown',
            buildDate: config.BuildDate || 'unknown',
            buildHash: config.BuildHash || 'unknown',
            buildHashEnterprise: config.BuildHashEnterprise || 'unknown',
            buildEnterpriseReady: config.BuildEnterpriseReady === 'true',
            siteUrl: config.SiteURL || baseUrl,
            dockerImageTag,
        };
    } catch (error) {
        console.warn(`  [WARN] Could not fetch server info: ${error instanceof Error ? error.message : error}`);
        return null;
    }
}

export function toBaselineMetric(stat: StatisticalSummary): BaselineMetric {
    const multiplier = 2;
    return {
        median: stat.median,
        stdDev: stat.stdDev,
        cv: stat.cv,
        min: stat.min,
        max: stat.max,
        lowerBound: Math.max(0, stat.median - multiplier * stat.stdDev),
        upperBound: stat.median + multiplier * stat.stdDev,
    };
}

/**
 * Prompt user for confirmation (Y/n)
 * Returns true for yes (default), false for no
 */
async function promptConfirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(`${message} [Y/n]: `, (answer) => {
            rl.close();
            const normalized = answer.trim().toLowerCase();
            // Default to yes (empty input), 'y' or 'yes' means yes
            resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
        });
    });
}

export async function saveBaseline(
    summaries: MultiRunSummary[],
    runsPerPage: number,
    baseUrl: string,
    skipConfirm: boolean = false,
    suffix: string = '',
): Promise<void> {
    const machine = getMachineInfo();
    const server = await getServerInfo(baseUrl);

    const serverVersion = server?.version || 'unknown';
    const versionedFileName = `${serverVersion}${suffix}_perf.json`;
    const versionedFilePath = path.resolve(BASELINE_DIR, versionedFileName);
    const latestBaselineFile = suffix ? path.resolve(BASELINE_DIR, `latest${suffix}_perf.json`) : LATEST_BASELINE_FILE;

    // Check if baseline files already exist
    const latestExists = fs.existsSync(latestBaselineFile);
    const versionedExists = fs.existsSync(versionedFilePath);
    const baselineExists = latestExists || versionedExists;

    // Load existing baseline to preserve pages that won't be updated (use suffix-specific file)
    const existingBaseline = suffix ? loadBaselineFromFile(latestBaselineFile) : loadBaseline();

    const baseline: LighthouseBaseline = {
        version: BASELINE_VERSION,
        createdAt: new Date().toISOString(),
        runsPerPage,
        machine,
        server: server || undefined,
        pages: existingBaseline?.pages || {},
    };

    // If baseline exists and not skipping confirmation, prompt for each page
    if (baselineExists && !skipConfirm) {
        console.log(`\nBaseline files already exist:`);
        if (latestExists) {
            console.log(`   Latest:    ${latestBaselineFile}`);
        }
        if (versionedExists) {
            console.log(`   Versioned: ${versionedFilePath}`);
        }
        console.log('');
    }

    const updatedPages: string[] = [];
    const skippedPages: string[] = [];

    for (const summary of summaries) {
        const pageId = summary.pageId;
        const pageExists = existingBaseline?.pages[pageId] !== undefined;

        let shouldUpdate = true;

        // Prompt for confirmation if baseline exists and not skipping
        if (baselineExists && !skipConfirm) {
            const existsNote = pageExists ? ' (exists)' : ' (new)';
            shouldUpdate = await promptConfirm(`Update baseline for '${pageId}'${existsNote}?`);
        }

        if (shouldUpdate) {
            baseline.pages[pageId] = {
                url: summary.url,
                performanceScore: toBaselineMetric(summary.stats.performanceScore),
                accessibilityScore: toBaselineMetric(summary.stats.accessibilityScore),
                bestPracticesScore: toBaselineMetric(summary.stats.bestPracticesScore),
                lcp: toBaselineMetric(summary.stats.lcp),
                tbt: toBaselineMetric(summary.stats.tbt),
                cls: toBaselineMetric(summary.stats.cls),
                fcp: toBaselineMetric(summary.stats.fcp),
                si: toBaselineMetric(summary.stats.si),
                tti: toBaselineMetric(summary.stats.tti),
                ttfb: toBaselineMetric(summary.stats.ttfb),
                maxFid: toBaselineMetric(summary.stats.maxFid),
                totalByteWeight: toBaselineMetric(summary.stats.totalByteWeight),
                mainThreadWork: toBaselineMetric(summary.stats.mainThreadWork),
                bootupTime: toBaselineMetric(summary.stats.bootupTime),
            };
            updatedPages.push(pageId);
        } else {
            skippedPages.push(pageId);
        }
    }

    // Only save if at least one page was updated
    if (updatedPages.length === 0) {
        console.log('\nNo pages were updated. Baseline unchanged.');
        return;
    }

    if (!fs.existsSync(BASELINE_DIR)) {
        fs.mkdirSync(BASELINE_DIR, {recursive: true});
    }

    fs.writeFileSync(latestBaselineFile, JSON.stringify(baseline, null, 2));
    fs.writeFileSync(versionedFilePath, JSON.stringify(baseline, null, 2));

    console.log(`\nBaseline saved:`);
    console.log(`   Latest:    file://${latestBaselineFile}`);
    console.log(`   Versioned: file://${versionedFilePath}`);
    console.log(`   Updated:   ${updatedPages.join(', ')}`);
    if (skippedPages.length > 0) {
        console.log(`   Skipped:   ${skippedPages.join(', ')}`);
    }
    console.log(`   Runs per page: ${runsPerPage}`);
    console.log(`   Machine: ${formatMachineInfo(machine)}`);
    if (server) {
        console.log(`   Server: ${formatServerInfo(server)}`);
    }
    console.log(`   Acceptable range: median ± 2×stdDev (95% confidence)`);
}

/**
 * Save multi-run results to results folder (similar format to baseline, for inspection)
 */
export async function saveResults(
    summaries: MultiRunSummary[],
    runsPerPage: number,
    baseUrl: string,
    suffix: string = '',
): Promise<string> {
    const machine = getMachineInfo();
    const server = await getServerInfo(baseUrl);

    const serverVersion = server?.version || 'unknown';

    const results: LighthouseBaseline = {
        version: BASELINE_VERSION,
        createdAt: new Date().toISOString(),
        runsPerPage,
        machine,
        server: server || undefined,
        pages: {},
    };

    for (const summary of summaries) {
        results.pages[summary.pageId] = {
            url: summary.url,
            performanceScore: toBaselineMetric(summary.stats.performanceScore),
            accessibilityScore: toBaselineMetric(summary.stats.accessibilityScore),
            bestPracticesScore: toBaselineMetric(summary.stats.bestPracticesScore),
            lcp: toBaselineMetric(summary.stats.lcp),
            tbt: toBaselineMetric(summary.stats.tbt),
            cls: toBaselineMetric(summary.stats.cls),
            fcp: toBaselineMetric(summary.stats.fcp),
            si: toBaselineMetric(summary.stats.si),
            tti: toBaselineMetric(summary.stats.tti),
            ttfb: toBaselineMetric(summary.stats.ttfb),
            maxFid: toBaselineMetric(summary.stats.maxFid),
            totalByteWeight: toBaselineMetric(summary.stats.totalByteWeight),
            mainThreadWork: toBaselineMetric(summary.stats.mainThreadWork),
            bootupTime: toBaselineMetric(summary.stats.bootupTime),
        };
    }

    if (!fs.existsSync(RESULTS_DIR)) {
        fs.mkdirSync(RESULTS_DIR, {recursive: true});
    }

    // Save with server version and optional suffix
    const resultsFileName = `${serverVersion}${suffix}_perf.json`;
    const resultsFilePath = path.resolve(RESULTS_DIR, resultsFileName);
    fs.writeFileSync(resultsFilePath, JSON.stringify(results, null, 2));

    console.log(`\nResults saved:`);
    console.log(`   file://${resultsFilePath}`);
    console.log(`   Server: ${server ? formatServerInfo(server) : 'unknown'}`);
    console.log(`   Machine: ${formatMachineInfo(machine)}`);

    return resultsFilePath;
}

export function printBaselineComparison(pageId: string, metrics: MetricsResult, suffix: string = ''): void {
    // Load baseline from suffix-specific file if suffix provided
    const baselineFile = suffix ? path.resolve(BASELINE_DIR, `latest${suffix}_perf.json`) : LATEST_BASELINE_FILE;
    const baseline = suffix ? loadBaselineFromFile(baselineFile) : loadBaseline();
    if (!baseline || !baseline.pages[pageId]) {
        const suffixNote = suffix ? ` (suffix: ${suffix})` : '';
        console.log(`\n  BASELINE: No baseline found for '${pageId}'${suffixNote}`);
        console.log(`     Run with --runs=N --baseline to create one`);
        return;
    }

    const base = baseline.pages[pageId];
    const isV2Plus = baseline.version >= '2.0';
    const rangeInfo = isV2Plus ? ' [acceptable range]' : '';

    console.log(
        `\n BASELINE COMPARISON (vs ${new Date(baseline.createdAt).toLocaleDateString()}, ${baseline.runsPerPage} runs):`,
    );
    if (baseline.machine) {
        console.log(`  Baseline machine: ${formatMachineInfo(baseline.machine)}`);
    }
    if (baseline.server) {
        console.log(`  Baseline server: ${formatServerInfo(baseline.server)}`);
    }
    console.log(`  Legend: ↑ improved | = acceptable | ! warning | ↓ regressed`);

    const audits = metrics.rawAudits;
    const currentPerf = metrics.performanceScore;
    const currentLcp = audits['largest-contentful-paint']?.numericValue || 0;
    const currentTbt = audits['total-blocking-time']?.numericValue || 0;
    const currentCls = audits['cumulative-layout-shift']?.numericValue || 0;
    const currentFcp = audits['first-contentful-paint']?.numericValue || 0;
    const currentSi = audits['speed-index']?.numericValue || 0;
    const currentTti = audits['interactive']?.numericValue || 0;
    const currentTtfb = audits['server-response-time']?.numericValue || 0;
    const currentMaxFid = audits['max-potential-fid']?.numericValue || 0;
    const currentTotalBytes = audits['total-byte-weight']?.numericValue || 0;
    const currentMainThread = audits['mainthread-work-breakdown']?.numericValue || 0;
    const currentBootup = audits['bootup-time']?.numericValue || 0;

    // Helper to format a comparison line with [PASS]/[FAIL] prefix and symbol
    const formatLine = (
        label: string,
        current: string,
        baselineMetric: BaselineMetric,
        currentValue: number,
        lowerIsBetter: boolean,
        unit: string,
        metricId?: string,
    ) => {
        const result = getComparisonWithStatus(currentValue, baselineMetric, lowerIsBetter, unit, metricId);
        return `  ${result.prefix} ${result.symbol} ${label} ${current} vs ${formatBaselineValue(baselineMetric, unit)}${result.comparison}`;
    };

    console.log(`\n Scores${rangeInfo}:`);
    console.log(
        formatLine('Performance:   ', `${currentPerf}/100`, base.performanceScore, currentPerf, false, 'score'),
    );
    console.log(
        formatLine(
            'Accessibility: ',
            `${metrics.accessibilityScore}/100`,
            base.accessibilityScore,
            metrics.accessibilityScore,
            false,
            'score',
        ),
    );
    console.log(
        formatLine(
            'Best Practices:',
            `${metrics.bestPracticesScore}/100`,
            base.bestPracticesScore,
            metrics.bestPracticesScore,
            false,
            'score',
        ),
    );

    console.log(`\n Core Web Vitals${rangeInfo}:`);
    console.log(formatLine('LCP:', `${(currentLcp / 1000).toFixed(2)}s`, base.lcp, currentLcp, true, 's', 'lcp'));
    console.log(formatLine('TBT:', `${(currentTbt / 1000).toFixed(2)}s`, base.tbt, currentTbt, true, 's', 'tbt'));
    console.log(formatLine('CLS:', `${currentCls.toFixed(3)}`, base.cls, currentCls, true, '', 'cls'));

    console.log(`\n Timing Metrics${rangeInfo}:`);
    console.log(formatLine('FCP:     ', `${(currentFcp / 1000).toFixed(2)}s`, base.fcp, currentFcp, true, 's', 'fcp'));
    console.log(formatLine('SI:      ', `${(currentSi / 1000).toFixed(2)}s`, base.si, currentSi, true, 's', 'si'));
    console.log(formatLine('TTI:     ', `${(currentTti / 1000).toFixed(2)}s`, base.tti, currentTti, true, 's', 'tti'));
    console.log(formatLine('TTFB:    ', `${(currentTtfb / 1000).toFixed(2)}s`, base.ttfb, currentTtfb, true, 's'));
    console.log(
        formatLine('Max FID: ', `${(currentMaxFid / 1000).toFixed(2)}s`, base.maxFid, currentMaxFid, true, 's'),
    );

    console.log(`\n Resources${rangeInfo}:`);
    console.log(
        formatLine(
            'Total Size:',
            `${(currentTotalBytes / 1024).toFixed(0)} KiB`,
            base.totalByteWeight,
            currentTotalBytes,
            true,
            'KiB',
        ),
    );

    console.log(`\n Diagnostics${rangeInfo}:`);
    console.log(
        formatLine(
            'Main Thread: ',
            `${(currentMainThread / 1000).toFixed(2)}s`,
            base.mainThreadWork,
            currentMainThread,
            true,
            's',
        ),
    );
    console.log(
        formatLine('JS Boot-up:  ', `${(currentBootup / 1000).toFixed(2)}s`, base.bootupTime, currentBootup, true, 's'),
    );
}

export function printMultiRunBaselineComparison(summary: MultiRunSummary, suffix: string = ''): void {
    // Load baseline from suffix-specific file if suffix provided
    const baselineFile = suffix ? path.resolve(BASELINE_DIR, `latest${suffix}_perf.json`) : LATEST_BASELINE_FILE;
    const baseline = suffix ? loadBaselineFromFile(baselineFile) : loadBaseline();
    if (!baseline || !baseline.pages[summary.pageId]) {
        const suffixNote = suffix ? ` (suffix: ${suffix})` : '';
        console.log(`\n  BASELINE: No baseline found for '${summary.pageId}'${suffixNote}`);
        console.log(`     Run with --runs=N --baseline to create one`);
        return;
    }

    const base = baseline.pages[summary.pageId];
    const {stats} = summary;
    const isV2Plus = baseline.version >= '2.0';
    const rangeInfo = isV2Plus ? ' [acceptable range]' : '';

    console.log(
        `\n BASELINE COMPARISON (vs ${new Date(baseline.createdAt).toLocaleDateString()}, ${baseline.runsPerPage} runs):`,
    );
    if (baseline.machine) {
        console.log(`  Baseline machine: ${formatMachineInfo(baseline.machine)}`);
    }
    if (baseline.server) {
        console.log(`  Baseline server: ${formatServerInfo(baseline.server)}`);
    }
    console.log(`  Legend: ↑ improved | = acceptable | ! warning | ↓ regressed`);

    // Helper to format a comparison line with [PASS]/[FAIL] prefix and symbol
    const formatLine = (
        label: string,
        current: string,
        baselineMetric: BaselineMetric,
        currentValue: number,
        lowerIsBetter: boolean,
        unit: string,
        metricId?: string,
    ) => {
        const result = getComparisonWithStatus(currentValue, baselineMetric, lowerIsBetter, unit, metricId);
        return `  ${result.prefix} ${result.symbol} ${label} ${current} vs ${formatBaselineValue(baselineMetric, unit)}${result.comparison}`;
    };

    console.log(`\n Scores (median vs baseline${rangeInfo}):`);
    console.log(
        formatLine(
            'Performance:   ',
            `${stats.performanceScore.median}/100`,
            base.performanceScore,
            stats.performanceScore.median,
            false,
            'score',
        ),
    );
    console.log(
        formatLine(
            'Accessibility: ',
            `${stats.accessibilityScore.median}/100`,
            base.accessibilityScore,
            stats.accessibilityScore.median,
            false,
            'score',
        ),
    );
    console.log(
        formatLine(
            'Best Practices:',
            `${stats.bestPracticesScore.median}/100`,
            base.bestPracticesScore,
            stats.bestPracticesScore.median,
            false,
            'score',
        ),
    );

    console.log(`\n Core Web Vitals (median vs baseline${rangeInfo}):`);
    console.log(
        formatLine('LCP:', `${(stats.lcp.median / 1000).toFixed(2)}s`, base.lcp, stats.lcp.median, true, 's', 'lcp'),
    );
    console.log(
        formatLine('TBT:', `${(stats.tbt.median / 1000).toFixed(2)}s`, base.tbt, stats.tbt.median, true, 's', 'tbt'),
    );
    console.log(formatLine('CLS:', `${stats.cls.median.toFixed(3)}`, base.cls, stats.cls.median, true, '', 'cls'));

    console.log(`\n Timing (median vs baseline${rangeInfo}):`);
    console.log(
        formatLine(
            'FCP:     ',
            `${(stats.fcp.median / 1000).toFixed(2)}s`,
            base.fcp,
            stats.fcp.median,
            true,
            's',
            'fcp',
        ),
    );
    console.log(
        formatLine('SI:      ', `${(stats.si.median / 1000).toFixed(2)}s`, base.si, stats.si.median, true, 's', 'si'),
    );
    console.log(
        formatLine(
            'TTI:     ',
            `${(stats.tti.median / 1000).toFixed(2)}s`,
            base.tti,
            stats.tti.median,
            true,
            's',
            'tti',
        ),
    );
    console.log(
        formatLine('TTFB:    ', `${(stats.ttfb.median / 1000).toFixed(2)}s`, base.ttfb, stats.ttfb.median, true, 's'),
    );
    console.log(
        formatLine(
            'Max FID: ',
            `${(stats.maxFid.median / 1000).toFixed(2)}s`,
            base.maxFid,
            stats.maxFid.median,
            true,
            's',
        ),
    );

    console.log(`\n Resources (median vs baseline${rangeInfo}):`);
    console.log(
        formatLine(
            'Total Size:',
            `${(stats.totalByteWeight.median / 1024).toFixed(0)} KiB`,
            base.totalByteWeight,
            stats.totalByteWeight.median,
            true,
            'KiB',
        ),
    );

    console.log(`\n Diagnostics (median vs baseline${rangeInfo}):`);
    console.log(
        formatLine(
            'Main Thread: ',
            `${(stats.mainThreadWork.median / 1000).toFixed(2)}s`,
            base.mainThreadWork,
            stats.mainThreadWork.median,
            true,
            's',
        ),
    );
    console.log(
        formatLine(
            'JS Boot-up:  ',
            `${(stats.bootupTime.median / 1000).toFixed(2)}s`,
            base.bootupTime,
            stats.bootupTime.median,
            true,
            's',
        ),
    );
}

export function printMultiRunSummary(summary: MultiRunSummary, suffix: string = ''): void {
    const {stats} = summary;

    console.log(`\n ${'─'.repeat(70)}`);
    console.log(` STATISTICAL SUMMARY (${summary.runs.length} successful runs)`);
    console.log(` ${'─'.repeat(70)}`);

    console.log(`\n Scores (median ± stdDev, CV%):`);
    console.log(
        `  Performance:     ${stats.performanceScore.median}/100 ± ${stats.performanceScore.stdDev} (CV: ${stats.performanceScore.cv}%)`,
    );
    console.log(
        `  Accessibility:   ${stats.accessibilityScore.median}/100 ± ${stats.accessibilityScore.stdDev} (CV: ${stats.accessibilityScore.cv}%)`,
    );
    console.log(
        `  Best Practices:  ${stats.bestPracticesScore.median}/100 ± ${stats.bestPracticesScore.stdDev} (CV: ${stats.bestPracticesScore.cv}%)`,
    );

    console.log(`\n Core Web Vitals (median ± stdDev [min - max]):`);
    console.log(`  LCP: ${formatSec(stats.lcp)}`);
    console.log(`  TBT: ${formatMs(stats.tbt)}`);
    console.log(
        `  CLS: ${stats.cls.median.toFixed(3)} ± ${stats.cls.stdDev.toFixed(3)} [${stats.cls.min.toFixed(3)} - ${stats.cls.max.toFixed(3)}]`,
    );

    console.log(`\n Timing Metrics (median ± stdDev [min - max]):`);
    console.log(`  FCP:      ${formatSec(stats.fcp)}`);
    console.log(`  SI:       ${formatSec(stats.si)}`);
    console.log(`  TTI:      ${formatSec(stats.tti)}`);
    console.log(`  TTFB:     ${formatMs(stats.ttfb)}`);
    console.log(`  Max FID:  ${formatMs(stats.maxFid)}`);

    console.log(`\n Resource Metrics (median ± stdDev [min - max]):`);
    console.log(`  Total Byte Weight: ${formatBytes(stats.totalByteWeight)}`);

    console.log(`\n Diagnostics (median ± stdDev [min - max]):`);
    console.log(`  Main Thread Work:  ${formatMs(stats.mainThreadWork)}`);
    console.log(`  JS Boot-up Time:   ${formatMs(stats.bootupTime)}`);

    console.log(`\n Percentiles (Performance Score):`);
    console.log(
        `  p50: ${stats.performanceScore.median} | p75: ${stats.performanceScore.p75} | p90: ${stats.performanceScore.p90} | p95: ${stats.performanceScore.p95}`,
    );

    const perfCV = stats.performanceScore.cv;
    let reliability = 'High';
    if (perfCV > 10) reliability = 'Medium';
    if (perfCV > 20) reliability = 'Low';
    console.log(`\n Reliability: ${reliability} (CV: ${perfCV}%)`);

    // Web Vitals grade (based on median values)
    const grade = getWebVitalsGrade({
        lcp: stats.lcp.median,
        tbt: stats.tbt.median,
        cls: stats.cls.median,
        fcp: stats.fcp.median,
        si: stats.si.median,
        tti: stats.tti.median,
    });
    console.log(`\n ${formatGrade(grade)}`);

    if (stats.performanceScore.outliers.length > 0) {
        console.log(` [WARN] Outliers detected: ${stats.performanceScore.outliers.join(', ')}`);
    }

    printMultiRunBaselineComparison(summary, suffix);
}
