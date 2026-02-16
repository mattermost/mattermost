import type {
    PlaywrightResults,
    Suite,
    Test,
    Stats,
    MergeResult,
    CalculationResult,
    FailedTest,
} from "./types";

interface TestInfo {
    title: string;
    file: string;
    finalStatus: string;
    hadFailure: boolean;
}

/**
 * Extract all tests from suites recursively with their info
 */
function getAllTestsWithInfo(suites: Suite[]): TestInfo[] {
    const tests: TestInfo[] = [];

    function extractFromSuite(suite: Suite) {
        for (const spec of suite.specs || []) {
            for (const test of spec.tests || []) {
                if (!test.results || test.results.length === 0) {
                    continue;
                }

                const finalResult = test.results[test.results.length - 1];
                const hadFailure = test.results.some(
                    (r) => r.status === "failed" || r.status === "timedOut",
                );

                tests.push({
                    title: spec.title || test.projectName,
                    file: test.location?.file || suite.file,
                    finalStatus: finalResult.status,
                    hadFailure,
                });
            }
        }
        for (const nestedSuite of suite.suites || []) {
            extractFromSuite(nestedSuite);
        }
    }

    for (const suite of suites) {
        extractFromSuite(suite);
    }

    return tests;
}

/**
 * Extract all tests from suites recursively
 */
function getAllTests(suites: Suite[]): Test[] {
    const tests: Test[] = [];

    function extractFromSuite(suite: Suite) {
        for (const spec of suite.specs || []) {
            tests.push(...spec.tests);
        }
        for (const nestedSuite of suite.suites || []) {
            extractFromSuite(nestedSuite);
        }
    }

    for (const suite of suites) {
        extractFromSuite(suite);
    }

    return tests;
}

/**
 * Compute stats from suites
 */
export function computeStats(
    suites: Suite[],
    originalStats?: Stats,
    retestStats?: Stats,
): Stats {
    const tests = getAllTests(suites);

    let expected = 0;
    let unexpected = 0;
    let skipped = 0;
    let flaky = 0;

    for (const test of tests) {
        if (!test.results || test.results.length === 0) {
            continue;
        }

        const finalResult = test.results[test.results.length - 1];
        const finalStatus = finalResult.status;

        // Check if any result was a failure
        const hadFailure = test.results.some(
            (r) => r.status === "failed" || r.status === "timedOut",
        );

        if (finalStatus === "skipped") {
            skipped++;
        } else if (finalStatus === "failed" || finalStatus === "timedOut") {
            unexpected++;
        } else if (finalStatus === "passed") {
            if (hadFailure) {
                flaky++;
            } else {
                expected++;
            }
        }
    }

    // Compute duration as sum of both runs
    const duration =
        (originalStats?.duration || 0) + (retestStats?.duration || 0);

    return {
        startTime: originalStats?.startTime || new Date().toISOString(),
        duration,
        expected,
        unexpected,
        skipped,
        flaky,
    };
}

/**
 * Get color based on pass rate
 */
function getColor(passRate: number): string {
    if (passRate === 100) {
        return "#43A047"; // green
    } else if (passRate >= 99) {
        return "#FFEB3B"; // yellow
    } else if (passRate >= 98) {
        return "#FF9800"; // orange
    } else {
        return "#F44336"; // red
    }
}

/**
 * Calculate all outputs from results
 */
export function calculateResults(
    results: PlaywrightResults,
): CalculationResult {
    const stats = results.stats || {
        expected: 0,
        unexpected: 0,
        skipped: 0,
        flaky: 0,
        startTime: new Date().toISOString(),
        duration: 0,
    };

    const passed = stats.expected;
    const failed = stats.unexpected;
    const flaky = stats.flaky;
    const skipped = stats.skipped;

    // Count unique spec files
    const specFiles = new Set<string>();
    for (const suite of results.suites) {
        specFiles.add(suite.file);
    }
    const totalSpecs = specFiles.size;

    // Get all tests with info for failed tests extraction
    const testsInfo = getAllTestsWithInfo(results.suites);

    // Extract failed specs
    const failedSpecsSet = new Set<string>();
    const failedTestsList: FailedTest[] = [];

    for (const test of testsInfo) {
        if (test.finalStatus === "failed" || test.finalStatus === "timedOut") {
            failedSpecsSet.add(test.file);
            failedTestsList.push({
                title: test.title,
                file: test.file,
            });
        }
    }

    const failedSpecs = Array.from(failedSpecsSet).join(",");
    const failedSpecsCount = failedSpecsSet.size;

    // Build failed tests markdown table (limit to 10)
    let failedTests = "";
    const uniqueFailedTests = failedTestsList.filter(
        (test, index, self) =>
            index ===
            self.findIndex(
                (t) => t.title === test.title && t.file === test.file,
            ),
    );

    if (uniqueFailedTests.length > 0) {
        const limitedTests = uniqueFailedTests.slice(0, 10);
        failedTests = limitedTests
            .map((t) => {
                const escapedTitle = t.title
                    .replace(/`/g, "\\`")
                    .replace(/\|/g, "\\|");
                return `| ${escapedTitle} | ${t.file} |`;
            })
            .join("\n");

        if (uniqueFailedTests.length > 10) {
            const remaining = uniqueFailedTests.length - 10;
            failedTests += `\n| _...and ${remaining} more failed tests_ | |`;
        }
    } else if (failed > 0) {
        failedTests = "| Unable to parse failed tests | - |";
    }

    // Calculate totals and pass rate
    const passing = passed + flaky;
    const total = passing + failed;
    const passRate = total > 0 ? ((passing * 100) / total).toFixed(2) : "0.00";
    const color = getColor(parseFloat(passRate));

    // Build commit status message
    const rate = total > 0 ? (passing * 100) / total : 0;
    const rateStr = rate === 100 ? "100%" : `${rate.toFixed(1)}%`;
    const specSuffix = totalSpecs > 0 ? `, ${totalSpecs} specs` : "";
    const commitStatusMessage =
        rate === 100
            ? `${rateStr} passed (${passing})${specSuffix}`
            : `${rateStr} passed (${passing}/${total}), ${failed} failed${specSuffix}`;

    return {
        passed,
        failed,
        flaky,
        skipped,
        totalSpecs,
        commitStatusMessage,
        failedSpecs,
        failedSpecsCount,
        failedTests,
        total,
        passRate,
        passing,
        color,
    };
}

/**
 * Merge original and retest results at suite level
 * - Keep original suites that are NOT in retest
 * - Add all retest suites (replacing matching originals)
 */
export function mergeResults(
    original: PlaywrightResults,
    retest: PlaywrightResults,
): MergeResult {
    // Get list of retested spec files
    const retestFiles = retest.suites.map((s) => s.file);

    // Filter original suites - keep only those NOT in retest
    const keptOriginalSuites = original.suites.filter(
        (suite) => !retestFiles.includes(suite.file),
    );

    // Merge: kept original suites + all retest suites
    const mergedSuites = [...keptOriginalSuites, ...retest.suites];

    // Compute stats from merged suites
    const stats = computeStats(mergedSuites, original.stats, retest.stats);

    const merged: PlaywrightResults = {
        config: original.config,
        suites: mergedSuites,
        stats,
    };

    return {
        merged,
        stats,
        totalSuites: mergedSuites.length,
        retestFiles,
    };
}
