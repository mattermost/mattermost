import * as fs from "fs/promises";
import * as path from "path";
import type {
    MochawesomeResult,
    ParsedSpecFile,
    CalculationResult,
    FailedTest,
    TestItem,
    SuiteItem,
    ResultItem,
} from "./types";

/**
 * Find all JSON files in a directory recursively
 */
async function findJsonFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await findJsonFiles(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile() && entry.name.endsWith(".json")) {
                files.push(fullPath);
            }
        }
    } catch {
        // Directory doesn't exist or not accessible
    }

    return files;
}

/**
 * Parse a mochawesome JSON file
 */
async function parseSpecFile(filePath: string): Promise<ParsedSpecFile | null> {
    try {
        const content = await fs.readFile(filePath, "utf8");
        const result: MochawesomeResult = JSON.parse(content);

        // Extract spec path from results[0].file
        const specPath = result.results?.[0]?.file;
        if (!specPath) {
            return null;
        }

        return {
            filePath,
            specPath,
            result,
        };
    } catch {
        return null;
    }
}

/**
 * Extract all tests from a result recursively
 */
function getAllTests(result: MochawesomeResult): TestItem[] {
    const tests: TestItem[] = [];

    function extractFromSuite(suite: SuiteItem | ResultItem) {
        tests.push(...(suite.tests || []));
        for (const nestedSuite of suite.suites || []) {
            extractFromSuite(nestedSuite);
        }
    }

    for (const resultItem of result.results || []) {
        extractFromSuite(resultItem);
    }

    return tests;
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
 * Calculate results from parsed spec files
 */
export function calculateResultsFromSpecs(
    specs: ParsedSpecFile[],
): CalculationResult {
    let passed = 0;
    let failed = 0;
    let pending = 0;
    const failedSpecsSet = new Set<string>();
    const failedTestsList: FailedTest[] = [];

    for (const spec of specs) {
        const tests = getAllTests(spec.result);

        for (const test of tests) {
            if (test.state === "passed") {
                passed++;
            } else if (test.state === "failed") {
                failed++;
                failedSpecsSet.add(spec.specPath);
                failedTestsList.push({
                    title: test.title,
                    file: spec.specPath,
                });
            } else if (test.state === "pending") {
                pending++;
            }
        }
    }

    const totalSpecs = specs.length;
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
    // Pass rate = passed / (passed + failed), excluding pending
    const total = passed + failed;
    const passRate = total > 0 ? ((passed * 100) / total).toFixed(2) : "0.00";
    const color = getColor(parseFloat(passRate));

    // Build commit status message
    const rate = total > 0 ? (passed * 100) / total : 0;
    const rateStr = rate === 100 ? "100%" : `${rate.toFixed(1)}%`;
    const specSuffix = totalSpecs > 0 ? `, ${totalSpecs} specs` : "";
    const commitStatusMessage =
        rate === 100
            ? `${rateStr} passed (${passed})${specSuffix}`
            : `${rateStr} passed (${passed}/${total}), ${failed} failed${specSuffix}`;

    return {
        passed,
        failed,
        pending,
        totalSpecs,
        commitStatusMessage,
        failedSpecs,
        failedSpecsCount,
        failedTests,
        total,
        passRate,
        color,
    };
}

/**
 * Load all spec files from a mochawesome results directory
 */
export async function loadSpecFiles(
    resultsPath: string,
): Promise<ParsedSpecFile[]> {
    // Mochawesome results are at: results/mochawesome-report/json/tests/
    const mochawesomeDir = path.join(
        resultsPath,
        "mochawesome-report",
        "json",
        "tests",
    );

    const jsonFiles = await findJsonFiles(mochawesomeDir);
    const specs: ParsedSpecFile[] = [];

    for (const file of jsonFiles) {
        const parsed = await parseSpecFile(file);
        if (parsed) {
            specs.push(parsed);
        }
    }

    return specs;
}

/**
 * Merge original and retest results
 * - For each spec in retest, replace the matching spec in original
 * - Keep original specs that are not in retest
 */
export async function mergeResults(
    originalPath: string,
    retestPath: string,
): Promise<{
    specs: ParsedSpecFile[];
    retestFiles: string[];
    mergedCount: number;
}> {
    const originalSpecs = await loadSpecFiles(originalPath);
    const retestSpecs = await loadSpecFiles(retestPath);

    // Build a map of original specs by spec path
    const specMap = new Map<string, ParsedSpecFile>();
    for (const spec of originalSpecs) {
        specMap.set(spec.specPath, spec);
    }

    // Replace with retest results
    const retestFiles: string[] = [];
    for (const retestSpec of retestSpecs) {
        specMap.set(retestSpec.specPath, retestSpec);
        retestFiles.push(retestSpec.specPath);
    }

    return {
        specs: Array.from(specMap.values()),
        retestFiles,
        mergedCount: retestSpecs.length,
    };
}

/**
 * Write merged results back to the original directory
 * This updates the original JSON files with retest results
 */
export async function writeMergedResults(
    originalPath: string,
    retestPath: string,
): Promise<{ updatedFiles: string[]; removedFiles: string[] }> {
    const mochawesomeDir = path.join(
        originalPath,
        "mochawesome-report",
        "json",
        "tests",
    );
    const retestMochawesomeDir = path.join(
        retestPath,
        "mochawesome-report",
        "json",
        "tests",
    );

    const originalJsonFiles = await findJsonFiles(mochawesomeDir);
    const retestJsonFiles = await findJsonFiles(retestMochawesomeDir);

    const updatedFiles: string[] = [];
    const removedFiles: string[] = [];

    // For each retest file, find and replace the original
    for (const retestFile of retestJsonFiles) {
        const retestSpec = await parseSpecFile(retestFile);
        if (!retestSpec) continue;

        const specPath = retestSpec.specPath;

        // Find all original files with matching spec path
        // Prefer nested path (under integration/), remove flat duplicates
        let nestedFile: string | null = null;
        const flatFiles: string[] = [];

        for (const origFile of originalJsonFiles) {
            const origSpec = await parseSpecFile(origFile);
            if (origSpec && origSpec.specPath === specPath) {
                if (origFile.includes("/integration/")) {
                    nestedFile = origFile;
                } else {
                    flatFiles.push(origFile);
                }
            }
        }

        // Update the nested file (proper location) or first flat file if no nested
        const retestContent = await fs.readFile(retestFile, "utf8");

        if (nestedFile) {
            await fs.writeFile(nestedFile, retestContent);
            updatedFiles.push(nestedFile);

            // Remove flat duplicates
            for (const flatFile of flatFiles) {
                await fs.unlink(flatFile);
                removedFiles.push(flatFile);
            }
        } else if (flatFiles.length > 0) {
            await fs.writeFile(flatFiles[0], retestContent);
            updatedFiles.push(flatFiles[0]);
        }
    }

    return { updatedFiles, removedFiles };
}
