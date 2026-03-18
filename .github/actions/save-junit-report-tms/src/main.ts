import * as core from "@actions/core";
import * as fs from "fs/promises";
import { XMLParser } from "fast-xml-parser";
import type {
    TestExecution,
    TestCycle,
    TestData,
    ZephyrApiClient,
} from "./types";

const zephyrCloudApiUrl = "https://api.zephyrscale.smartbear.com/v2";

function newTestExecution(
    testCaseKey: string,
    statusName: string,
    executionTime: number,
    comment: string,
): TestExecution {
    return {
        testCaseKey,
        statusName, // Pass or Fail
        executionTime,
        comment,
    };
}

export async function getTestData(
    junitFile: string,
    config: {
        projectKey: string;
        zephyrFolderId: number;
        branch: string;
        buildImage: string;
        buildNumber: string;
        githubRunUrl: string;
    },
): Promise<TestData> {
    const testCycle: TestCycle = {
        projectKey: config.projectKey,
        name: `mmctl: E2E Tests with ${config.branch}, ${config.buildImage}, ${config.buildNumber}`,
        description: "",
        statusName: "Done",
        folderId: config.zephyrFolderId,
    };

    // Create dynamic regex based on project key (e.g., MM-T1234, FOO-T5678)
    const reTestKey = new RegExp(`${config.projectKey}-T\\d+`);
    const testExecutions: TestExecution[] = [];

    const data = await fs.readFile(junitFile, "utf8");

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    const result = parser.parse(data);

    // Parse test results and collect test data
    let totalTests = 0;
    let totalFailures = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    let totalTime = 0;
    let earliestTimestamp: Date | null = null;
    let latestTimestamp: Date | null = null;

    // Track test keys by status
    const testKeysPassed = new Set<string>();
    const testKeysFailed = new Set<string>();
    const testKeysSkipped = new Set<string>();
    let totalTestKeyOccurrences = 0;

    if (result?.testsuites?.testsuite) {
        const testsuites = Array.isArray(result.testsuites.testsuite)
            ? result.testsuites.testsuite
            : [result.testsuites.testsuite];

        for (const testsuite of testsuites) {
            const tests = parseInt(testsuite["@_tests"] || "0", 10);
            const failures = parseInt(testsuite["@_failures"] || "0", 10);
            const errors = parseInt(testsuite["@_errors"] || "0", 10);
            const skipped = parseInt(testsuite["@_skipped"] || "0", 10);
            const time = parseFloat(testsuite["@_time"] || "0");

            totalTests += tests;
            totalFailures += failures;
            totalErrors += errors;
            totalSkipped += skipped;
            totalTime += time;

            // Extract timestamp if available
            const timestamp = testsuite["@_timestamp"];
            if (timestamp) {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    if (!earliestTimestamp || date < earliestTimestamp) {
                        earliestTimestamp = date;
                    }
                    if (!latestTimestamp || date > latestTimestamp) {
                        latestTimestamp = date;
                    }
                }
            }

            if (testsuite?.testcase) {
                const testcases = Array.isArray(testsuite.testcase)
                    ? testsuite.testcase
                    : [testsuite.testcase];

                for (const testcase of testcases) {
                    const testName = testcase["@_name"];
                    const testTime = testcase["@_time"] || 0;
                    const hasFailure = testcase.failure !== undefined;
                    const hasSkipped = testcase.skipped !== undefined;

                    if (testName) {
                        const match = testName.match(reTestKey);

                        if (match !== null) {
                            const testKey = match[0];
                            totalTestKeyOccurrences++;
                            testCycle.description += `* ${testKey} - ${testTime}s\n`;

                            let statusName: string;
                            if (hasSkipped) {
                                statusName = "Not Executed";
                                testKeysSkipped.add(testKey);
                            } else if (hasFailure) {
                                statusName = "Fail";
                                testKeysFailed.add(testKey);
                            } else {
                                statusName = "Pass";
                                testKeysPassed.add(testKey);
                            }

                            testExecutions.push(
                                newTestExecution(
                                    testKey,
                                    statusName,
                                    parseFloat(testTime),
                                    testName,
                                ),
                            );
                        }
                    }
                }
            }
        }
    }

    // Log detailed summary
    core.startGroup("JUnit report summary");
    core.info(`  - Total tests: ${totalTests}`);
    core.info(`  - Failures: ${totalFailures}`);
    core.info(`  - Errors: ${totalErrors}`);
    core.info(`  - Skipped: ${totalSkipped}`);
    const timeInMinutes = (totalTime / 60).toFixed(1);
    core.info(`  - Duration: ${totalTime.toFixed(1)}s (~${timeInMinutes}m)`);
    core.endGroup();

    core.startGroup("Extracted MM-T test cases");
    const uniqueTestKeys = new Set([
        ...testKeysPassed,
        ...testKeysFailed,
        ...testKeysSkipped,
    ]);
    core.info(`  - Total test key occurrences: ${totalTestKeyOccurrences}`);
    core.info(`  - Unique test keys: ${uniqueTestKeys.size}`);
    core.info(`  - Passed: ${testKeysPassed.size} test keys`);
    if (testKeysFailed.size > 0) {
        core.info(
            `  - Failed: ${testKeysFailed.size} test keys (${Array.from(testKeysFailed).join(", ")})`,
        );
    } else {
        core.info(`  - Failed: ${testKeysFailed.size} test keys`);
    }
    if (testKeysSkipped.size > 0) {
        core.info(
            `  - Skipped: ${testKeysSkipped.size} test keys (${Array.from(testKeysSkipped).join(", ")})`,
        );
    } else {
        core.info(`  - Skipped: ${testKeysSkipped.size} test keys`);
    }
    core.endGroup();

    // Build the description with summary and link
    const passedTests = totalTests - totalFailures;
    const passRate =
        totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : "0";

    testCycle.description = `Test Summary: `;
    testCycle.description += `${passedTests} passed | `;
    testCycle.description += `${totalFailures} failed | `;
    testCycle.description += `${passRate}% pass rate | `;
    testCycle.description += `${totalTime.toFixed(1)}s duration | `;

    testCycle.description += `branch: ${config.branch} | `;
    testCycle.description += `build image: ${config.buildImage} | `;
    testCycle.description += `build number: ${config.buildNumber} | `;

    testCycle.description += `${config.githubRunUrl}`;

    // Calculate and set planned start and end dates
    if (earliestTimestamp) {
        // Use the earliest timestamp from the report as the start date
        testCycle.plannedStartDate = earliestTimestamp.toISOString();

        // Calculate end date: if we have a latest timestamp, use it
        // Otherwise, calculate from start + total duration
        if (latestTimestamp && latestTimestamp > earliestTimestamp) {
            testCycle.plannedEndDate = latestTimestamp.toISOString();
        } else {
            // Add total duration (in seconds) to start time
            const endDate = new Date(
                earliestTimestamp.getTime() + totalTime * 1000,
            );
            testCycle.plannedEndDate = endDate.toISOString();
        }
    }

    return {
        testCycle,
        testExecutions,
        junitStats: {
            totalTests,
            totalFailures,
            totalErrors,
            totalSkipped,
            totalPassed: passedTests,
            passRate,
            totalTime,
        },
        testKeyStats: {
            totalOccurrences: totalTestKeyOccurrences,
            uniqueCount: uniqueTestKeys.size,
            passedCount: testKeysPassed.size,
            failedCount: testKeysFailed.size,
            skippedCount: testKeysSkipped.size,
            failedKeys: Array.from(testKeysFailed),
            skippedKeys: Array.from(testKeysSkipped),
        },
    };
}

// Sort test executions by status (Pass, Fail, Not Executed), then by test key
export function sortTestExecutions(
    executions: TestExecution[],
): TestExecution[] {
    const statusOrder: Record<string, number> = {
        Pass: 1,
        Fail: 2,
        "Not Executed": 3,
    };

    return [...executions].sort((a, b) => {
        // First, sort by status
        const statusA = statusOrder[a.statusName] || 999;
        const statusB = statusOrder[b.statusName] || 999;
        const statusComparison = statusA - statusB;
        if (statusComparison !== 0) {
            return statusComparison;
        }

        // Then, sort by test key
        return a.testCaseKey.localeCompare(b.testCaseKey);
    });
}

// Write GitHub Actions summary using core.summary API
export async function writeGitHubSummary(
    testCycle: TestCycle,
    junitStats: TestData["junitStats"],
    testKeyStats: TestData["testKeyStats"],
    successCount: number,
    failureCount: number,
    uniqueSavedTestKeys: Set<string>,
    uniqueFailedTestKeys: Set<string>,
    projectKey: string,
    testCycleKey: string,
): Promise<void> {
    const timeInMinutes = (junitStats.totalTime / 60).toFixed(1);
    const zephyrUrl = `https://mattermost.atlassian.net/projects/${projectKey}?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.kanoah.test-manager__main-project-page#!/v2/testCycle/${testCycleKey}`;

    const summary = core.summary
        .addHeading("mmctl: E2E Test Report", 2)
        .addHeading("JUnit report summary", 3)
        .addTable([
            ["Total tests", `${junitStats.totalTests}`],
            ["Passed", `${junitStats.totalPassed}`],
            ["Failed", `${junitStats.totalFailures}`],
            ["Skipped", `${junitStats.totalSkipped}`],
            ["Error", `${junitStats.totalErrors}`],
            [
                "Duration",
                `${junitStats.totalTime.toFixed(1)}s (~${timeInMinutes}m)`,
            ],
        ])
        .addHeading("Extracted MM-T test cases", 3)
        .addTable([
            ["Total tests found", `${testKeyStats.totalOccurrences}`],
            ["Unique test keys", `${testKeyStats.uniqueCount}`],
            ["Passed", `${testKeyStats.passedCount} test keys`],
            ["Failed", `${testKeyStats.failedCount} test keys`],
            ["Skipped", `${testKeyStats.skippedCount} test keys`],
        ])
        .addHeading("Zephyr Scale Results", 3)
        .addTable([
            ["Test cycle key", `${testCycleKey}`],
            ["Test cycle name", `${testCycle.name}`],
            [
                "Successfully saved",
                `${successCount} executions (${uniqueSavedTestKeys.size} unique test keys)`,
            ],

            ...(failureCount === 0
                ? []
                : [
                      [
                          "Failed on saving",
                          `${failureCount} executions (${uniqueFailedTestKeys.size} unique test keys)`,
                      ],
                  ]),
        ])
        .addLink("View in Zephyr", zephyrUrl);

    await summary.write();
}

// Create Zephyr API client implementation
export function createZephyrApiClient(apiKey: string): ZephyrApiClient {
    return {
        async createTestCycle(testCycle: TestCycle): Promise<{ key: string }> {
            const response = await fetch(`${zephyrCloudApiUrl}/testcycles`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json; charset=utf-8",
                },
                body: JSON.stringify(testCycle),
            });

            if (!response.ok) {
                const errorDetails = await response.json();
                throw new Error(
                    `Failed to create test cycle: ${JSON.stringify(errorDetails)} (Status: ${response.status})`,
                );
            }

            return await response.json();
        },

        async saveTestExecution(
            testExecution: TestExecution,
            retries = 3,
        ): Promise<void> {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const response = await fetch(
                        `${zephyrCloudApiUrl}/testexecutions`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${apiKey}`,
                                "Content-Type":
                                    "application/json; charset=utf-8",
                            },
                            body: JSON.stringify(testExecution),
                        },
                    );

                    if (!response.ok) {
                        const errorBody = await response.text();
                        throw new Error(
                            `HTTP ${response.status}: ${errorBody}`,
                        );
                    }

                    const responseData = await response.json();
                    core.info(
                        `Saved test execution: ${testExecution.testCaseKey} (${testExecution.statusName}) - Response: ${JSON.stringify(responseData)}`,
                    );
                    return; // Success
                } catch (error) {
                    const errorMsg =
                        error instanceof Error ? error.message : String(error);
                    core.warning(
                        `Error saving test execution for ${testExecution.testCaseKey} (attempt ${attempt}/${retries}): ${errorMsg}`,
                    );

                    if (attempt === retries) {
                        throw new Error(
                            `Failed after ${retries} attempts: ${errorMsg}`,
                        );
                    }

                    // Wait before retry (exponential backoff)
                    const delay = 1000 * attempt;
                    core.info(
                        `Retrying ${testExecution.testCaseKey} in ${delay}ms...`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        },
    };
}

export async function run(): Promise<void> {
    // GitHub environment variables
    const branch =
        process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "unknown";
    const githubRepository = process.env.GITHUB_REPOSITORY || "";
    const githubRunId = process.env.GITHUB_RUN_ID || "";
    const githubRunUrl =
        githubRepository && githubRunId
            ? `https://github.com/${githubRepository}/actions/runs/${githubRunId}`
            : "";

    // Generate build number from GitHub environment variables
    const buildNumber = `${branch}-${githubRunId}`;

    // Required inputs
    const reportPath = core.getInput("report-path", { required: true });
    const buildImage = core.getInput("build-image", { required: true });
    const zephyrApiKey = core.getInput("zephyr-api-key", { required: true });

    // Optional inputs with defaults
    const zephyrFolderId = parseInt(
        core.getInput("zephyr-folder-id") || "27504432",
        10,
    );
    const projectKey = core.getInput("jira-project-key") || "MM";

    // Validate required fields
    if (!reportPath) {
        throw new Error("report-path is required");
    }
    if (!buildImage) {
        throw new Error("build-image is required");
    }
    if (!zephyrApiKey) {
        throw new Error("zephyr-api-key is required");
    }

    core.info(`Reading report file from: ${reportPath}`);
    core.info(`  - Branch: ${branch}`);
    core.info(`  - Build Image: ${buildImage}`);
    core.info(`  - Build Number: ${buildNumber}`);

    const { testCycle, testExecutions, junitStats, testKeyStats } =
        await getTestData(reportPath, {
            projectKey,
            zephyrFolderId,
            branch,
            buildImage,
            buildNumber,
            githubRunUrl,
        });

    const client = createZephyrApiClient(zephyrApiKey);

    core.startGroup("Creating test cycle and saving test executions in Zephyr");

    // Create test cycle
    const createdTestCycle = await client.createTestCycle(testCycle);
    core.info(`Created test cycle: ${createdTestCycle.key}`);

    // Sort and save test executions
    const sortedExecutions = sortTestExecutions(testExecutions);

    const promises = sortedExecutions.map((testExecution) => {
        // Add project key and test cycle key
        testExecution.projectKey = projectKey;
        testExecution.testCycleKey = createdTestCycle.key;

        return client
            .saveTestExecution(testExecution)
            .then(() => ({
                success: true,
                testCaseKey: testExecution.testCaseKey,
            }))
            .catch((error) => ({
                success: false,
                testCaseKey: testExecution.testCaseKey,
                error: error.message,
            }));
    });
    const results = await Promise.all(promises);
    core.endGroup();

    let successCount = 0;
    let failureCount = 0;
    const savedTestKeys: string[] = [];
    const failedTestKeys: string[] = [];

    results.forEach((result) => {
        if (result.success) {
            successCount++;
            savedTestKeys.push(result.testCaseKey);
        } else {
            failureCount++;
            failedTestKeys.push(result.testCaseKey);
            const error = "error" in result ? result.error : "Unknown error";
            core.warning(
                `Test execution failed for ${result.testCaseKey}: ${error}`,
            );
        }
    });

    // Calculate unique test keys
    const uniqueSavedTestKeys = new Set(savedTestKeys);
    const uniqueFailedTestKeys = new Set(failedTestKeys);

    // Create GitHub Actions summary (only if running in GitHub Actions environment)
    if (process.env.GITHUB_STEP_SUMMARY) {
        await writeGitHubSummary(
            testCycle,
            junitStats,
            testKeyStats,
            successCount,
            failureCount,
            uniqueSavedTestKeys,
            uniqueFailedTestKeys,
            projectKey,
            createdTestCycle.key,
        );
    }

    core.startGroup("Zephyr Scale Results");
    core.info(`Test cycle key: ${createdTestCycle.key}`);
    core.info(`Test cycle name: ${testCycle.name}`);
    core.info(
        `Successfully saved: ${successCount} executions (${uniqueSavedTestKeys.size} unique test keys)`,
    );
    if (failureCount > 0) {
        core.info(
            `Failed to save: ${failureCount} executions (${uniqueFailedTestKeys.size} unique test keys)`,
        );
    }
    core.info(
        `View in Zephyr: https://mattermost.atlassian.net/projects/${projectKey}?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.kanoah.test-manager__main-project-page#!/v2/testCycle/${createdTestCycle.key}`,
    );

    if (failedTestKeys.length > 0) {
        core.info(
            `Failed test keys (${failedTestKeys.length} total, ${uniqueFailedTestKeys.size} unique): ${failedTestKeys.join(", ")}`,
        );
    }
    core.endGroup();

    // JUnit summary outputs
    core.setOutput("junit-total-tests", junitStats.totalTests);
    core.setOutput("junit-total-passed", junitStats.totalPassed);
    core.setOutput("junit-total-failed", junitStats.totalFailures);
    core.setOutput("junit-pass-rate", junitStats.passRate);
    core.setOutput("junit-duration-seconds", junitStats.totalTime.toFixed(1));

    // Zephyr results outputs
    core.setOutput("test-cycle", createdTestCycle.key);
    core.setOutput("test-keys-execution-count", testExecutions.length);
    core.setOutput("test-keys-unique-count", uniqueSavedTestKeys.size);
}
