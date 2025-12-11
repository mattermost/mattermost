#!/usr/bin/env npx ts-node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Standalone Lighthouse runner for performance testing
 * Run with: npm run lh
 *
 * Usage:
 *   npm run lh                         # Run on login page (default)
 *   npm run lh -- --login              # Run on login page
 *   npm run lh -- --channels           # Run on channels page (requires auth)
 *   npm run lh -- --admin              # Run on admin console (requires auth + pre-auth)
 *   npm run lh -- --all                # Run on all pages
 *   npm run lh -- --setup-auth         # Create auth session before running
 *   npm run lh -- --runs=5             # Run 5 iterations with statistical analysis
 *   npm run lh -- --all --runs=10      # Run all pages 10 times each
 *   npm run baseline                   # Save results as baseline (10 runs, all pages)
 *   npm run lh -- --url=http://localhost:8065/custom --auth
 *
 * Options:
 *   --auth       Use authentication cookies from storage_state/
 *   --pre-auth   Pre-authenticate by visiting base URL first (needed for pages like /admin_console)
 *   --setup-auth Create authentication session before running tests (auto-runs if auth missing)
 *   --runs=N     Run N iterations per page and report statistical summary (default: 1)
 *   --baseline   Save multi-run results as baseline for future comparison
 *   --baseline-suffix=SUFFIX  Add suffix to baseline filename (e.g., "_no_plugins")
 *   --yes, -y    Skip confirmation prompts when updating existing baselines
 *
 * Environment Variables:
 *   MM_BASE_URL       - Mattermost server URL (default: http://localhost:8065)
 *   MM_ADMIN_USERNAME - Admin username (default: sysadmin)
 *   MM_ADMIN_PASSWORD - Admin password (default: Sys@dmin-sample1)
 *   DOCKER_IMAGE_TAG  - Docker image tag for baseline tracking (optional)
 *   MM_DOCKER_IMAGE   - Alternative Docker image tag env var (optional)
 */

import * as fs from 'fs';
import * as path from 'path';

import {setupAuth} from './auth';
import {saveBaseline, saveResults} from './baseline';
import {RESULTS_DIR} from './constants';
import type {WebVitalsGrade, MetricGrade} from './format';
import {runLighthouse, runLighthouseMultiple} from './runner';
import type {MultiRunSummary, PageConfig} from './types';

type OverallGrade = 'PASS' | 'WARN' | 'FAIL';

interface LighthouseScores {
    performance: number;
    accessibility: number;
    bestPractices: number;
}

interface PageGrade {
    pageId: string;
    grade: OverallGrade;
    scores?: LighthouseScores;
    issues?: string[];
}

interface GradesSummary {
    overall: OverallGrade;
    scores?: LighthouseScores;
    pages: PageGrade[];
}

function formatMetricIssue(m: MetricGrade): string {
    const valueStr = m.id === 'cls' ? m.value.toFixed(3) : `${(m.value / 1000).toFixed(2)}s`;
    const thresholdStr = m.id === 'cls' ? m.goodThreshold.toFixed(3) : `${(m.goodThreshold / 1000).toFixed(1)}s`;
    const statusLabel = m.status === 'poor' ? 'poor' : 'needs improvement';
    return `${m.name}: ${valueStr} (${statusLabel}, threshold: ${thresholdStr})`;
}

function getIssuesFromGrade(grade: WebVitalsGrade): string[] {
    return grade.metrics.filter((m) => m.status !== 'good').map(formatMetricIssue);
}

async function main() {
    const baseUrl = process.env.MM_BASE_URL || 'http://localhost:8065';
    const args = process.argv.slice(2);

    console.log('Web Vitals with Lighthouse');
    console.log(`   Base URL: ${baseUrl}\n`);

    const pages: PageConfig[] = [];

    const runAll = args.includes('--all') || args.includes('-A');
    const runLogin = args.includes('--login') || args.includes('-l') || runAll;
    const runChannels = args.includes('--channels') || args.includes('-c') || runAll;
    const runAdmin = args.includes('--admin') || args.includes('-a') || runAll;
    const forceSetupAuth = args.includes('--setup-auth');

    const runsArg = args.find((a) => a.startsWith('--runs='));
    const numRuns = runsArg ? parseInt(runsArg.split('=')[1], 10) : 1;
    const saveAsBaseline = args.includes('--baseline');
    const skipConfirm = args.includes('--yes') || args.includes('-y');
    const baselineSuffixArg = args.find((a) => a.startsWith('--baseline-suffix='));
    const baselineSuffix = baselineSuffixArg ? baselineSuffixArg.split('=')[1] : '';

    if (numRuns > 1) {
        console.log(`   Multi-run mode: ${numRuns} iterations per page`);
    }
    if (saveAsBaseline) {
        console.log(`   Baseline mode: Results will be saved as baseline`);
    }
    if (baselineSuffix) {
        console.log(`   Baseline suffix: ${baselineSuffix}`);
    }

    if (!runLogin && !runChannels && !runAdmin && !args.find((a) => a.startsWith('--url='))) {
        pages.push({id: 'login', url: `${baseUrl}/login`, auth: false});
    }

    if (runLogin) {
        pages.push({id: 'login', url: `${baseUrl}/login`, auth: false});
    }
    if (runChannels) {
        pages.push({id: 'channels', url: `${baseUrl}/`, auth: true});
    }
    if (runAdmin) {
        pages.push({id: 'admin_console', url: `${baseUrl}/admin_console`, auth: true, needsPreAuth: true});
    }

    const urlArg = args.find((a) => a.startsWith('--url='));
    if (urlArg) {
        const url = urlArg.split('=')[1];
        const auth = args.includes('--auth');
        const needsPreAuth = args.includes('--pre-auth');
        pages.push({id: 'custom', url, auth, needsPreAuth});
    }

    const needsAuth = pages.some((p) => p.auth);

    // Always perform fresh authentication when pages require it
    // This avoids issues with stale/expired sessions in storage state
    if (forceSetupAuth || needsAuth) {
        console.log('Setting up fresh authentication session...');
        const authSuccess = await setupAuth(baseUrl);
        if (!authSuccess && needsAuth) {
            console.error('\n[ERROR] Cannot run authenticated pages without auth. Exiting.');
            process.exit(1);
        }
    }

    const summaries: MultiRunSummary[] = [];
    const grades: PageGrade[] = [];
    const failedPages: string[] = [];

    for (const page of pages) {
        if (numRuns > 1) {
            const result = await runLighthouseMultiple(
                page.url,
                page.id,
                numRuns,
                page.auth,
                page.needsPreAuth,
                baselineSuffix,
            );
            if (result) {
                summaries.push(result.summary);
                const issues = getIssuesFromGrade(result.grade);
                const scores: LighthouseScores = {
                    performance: Math.round(result.summary.stats.performanceScore.median),
                    accessibility: Math.round(result.summary.stats.accessibilityScore.median),
                    bestPractices: Math.round(result.summary.stats.bestPracticesScore.median),
                };
                grades.push({
                    pageId: page.id,
                    grade: result.grade.overall,
                    scores,
                    issues: issues.length > 0 ? issues : undefined,
                });
            } else {
                // All runs failed for this page
                failedPages.push(page.id);
            }
        } else {
            const gradeResult = await runLighthouse(page.url, page.id, page.auth, page.needsPreAuth, baselineSuffix);
            if (gradeResult) {
                const issues = getIssuesFromGrade(gradeResult);
                grades.push({
                    pageId: page.id,
                    grade: gradeResult.overall,
                    issues: issues.length > 0 ? issues : undefined,
                });
            } else {
                // Run failed for this page
                failedPages.push(page.id);
            }
        }
    }

    if (saveAsBaseline && summaries.length > 0) {
        await saveBaseline(summaries, numRuns, baseUrl, skipConfirm, baselineSuffix);
    } else if (saveAsBaseline && summaries.length === 0) {
        console.warn('\n[WARN] Cannot save baseline: No multi-run summaries available.');
        console.warn('   Use --runs=N with --baseline to generate baseline data.');
    } else if (!saveAsBaseline && summaries.length > 0) {
        // Save results to results folder for inspection (without updating baseline)
        await saveResults(summaries, numRuns, baseUrl, baselineSuffix);
    }

    // Check for complete failures first
    if (failedPages.length > 0) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('Lighthouse tests failed!');
        console.log(`   ${failedPages.length} page(s) failed completely: ${failedPages.join(', ')}`);
        console.log(`${'='.repeat(60)}\n`);
        process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('All Lighthouse tests complete!');
    if (numRuns > 1 && summaries.length > 0) {
        console.log(`   ${summaries.length} page(s) analyzed with ${numRuns} runs each`);
        if (saveAsBaseline) {
            console.log(`   Baseline saved with median values`);
        }
    }

    // Determine overall grade: FAIL if any FAIL, otherwise PASS (WARN counts as PASS)
    if (grades.length > 0) {
        const hasFail = grades.some((g) => g.grade === 'FAIL');
        const overallGrade: OverallGrade = hasFail ? 'FAIL' : 'PASS';

        console.log(`\nOverall Web Vitals: [${overallGrade}]`);
        for (const g of grades) {
            console.log(`   ${g.pageId}: ${g.grade}`);
            if (g.issues && g.issues.length > 0) {
                for (const issue of g.issues) {
                    console.log(`      - ${issue}`);
                }
            }
        }

        // Calculate overall scores (average of pages with scores)
        const pagesWithScores = grades.filter((g) => g.scores);
        let overallScores: LighthouseScores | undefined;
        if (pagesWithScores.length > 0) {
            overallScores = {
                performance: Math.round(
                    pagesWithScores.reduce((sum, g) => sum + g.scores!.performance, 0) / pagesWithScores.length,
                ),
                accessibility: Math.round(
                    pagesWithScores.reduce((sum, g) => sum + g.scores!.accessibility, 0) / pagesWithScores.length,
                ),
                bestPractices: Math.round(
                    pagesWithScores.reduce((sum, g) => sum + g.scores!.bestPractices, 0) / pagesWithScores.length,
                ),
            };
        }

        // Save grades summary for CI status reporting
        const gradesSummary: GradesSummary = {
            overall: overallGrade,
            scores: overallScores,
            pages: grades,
        };
        if (!fs.existsSync(RESULTS_DIR)) {
            fs.mkdirSync(RESULTS_DIR, {recursive: true});
        }
        fs.writeFileSync(path.join(RESULTS_DIR, 'grades.json'), JSON.stringify(gradesSummary, null, 2));

        console.log(`${'='.repeat(60)}\n`);

        // NOTE: Web Vitals failures do not fail the job for now (monitoring mode)
        // Once thresholds are resolved, uncomment to enforce:
        // if (hasFail) {
        //     process.exit(1);
        // }
    } else {
        console.log(`${'='.repeat(60)}\n`);
    }
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
