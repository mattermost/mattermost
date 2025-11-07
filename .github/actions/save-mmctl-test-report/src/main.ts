import * as core from "@actions/core";
import * as fs from "fs/promises";
import { XMLParser } from "fast-xml-parser";

const reTestKey = /MM-T\d+/;
const zephyrCloudApiUrl = "https://api.zephyrscale.smartbear.com/v2";

interface TestExecution {
    testCaseKey: string;
    statusName: string;
    executionTime: number;
    comment: string;
    projectKey?: string;
    testCycleKey?: string;
}

interface TestCycle {
    projectKey: string;
    name: string;
    description: string;
    statusName: string;
    folderId: number;
    plannedStartDate?: string;
    plannedEndDate?: string;
    customFields?: Record<string, any>;
}

interface TestData {
    testCycle: TestCycle;
    testExecutions: TestExecution[];
    xmlStats: {
        totalTests: number;
        totalFailures: number;
        totalPassed: number;
        passRate: string;
        totalTime: number;
    };
}

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

async function getTestData(
    xmlFile: string,
    config: {
        projectKey: string;
        zephyrFolderId: number;
        branch: string;
        buildImage: string;
        buildNumber: string;
        githubRunUrl?: string;
    },
): Promise<TestData> {
    const testCycle: TestCycle = {
        projectKey: config.projectKey,
        name: `mmctl: E2E Tests with ${config.branch}, ${config.buildImage}, ${config.buildNumber}`,
        description: "",
        statusName: "Done",
        folderId: config.zephyrFolderId,
    };

    const testExecutions: TestExecution[] = [];

    const data = await fs.readFile(xmlFile, "utf8");

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    const result = parser.parse(data);

    // Parse test results and collect test data
    let totalTests = 0;
    let totalFailures = 0;
    let totalTime = 0;
    let earliestTimestamp: Date | null = null;
    let latestTimestamp: Date | null = null;

    if (result?.testsuites?.testsuite) {
        const testsuites = Array.isArray(result.testsuites.testsuite)
            ? result.testsuites.testsuite
            : [result.testsuites.testsuite];

        for (const testsuite of testsuites) {
            const tests = parseInt(testsuite["@_tests"] || "0", 10);
            const failures = parseInt(testsuite["@_failures"] || "0", 10);
            const time = parseFloat(testsuite["@_time"] || "0");

            totalTests += tests;
            totalFailures += failures;
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

                    if (testName) {
                        const match = testName.match(reTestKey);

                        if (match !== null) {
                            const testKey = match[0];
                            testCycle.description += `* ${testKey} - ${testTime}s\n`;

                            testExecutions.push(
                                newTestExecution(
                                    testKey,
                                    hasFailure ? "Fail" : "Pass",
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

    // Build the description with summary and link
    const passedTests = totalTests - totalFailures;
    const passRate =
        totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : "0";

    testCycle.description = `### Test Summary\n\n`;
    testCycle.description += `**${passedTests}** passed | `;
    testCycle.description += `**${totalFailures}** failed | `;
    testCycle.description += `**${passRate}%** pass rate | `;
    testCycle.description += `**${totalTime.toFixed(1)}s** duration\n\n`;

    if (config.githubRunUrl) {
        testCycle.description += `[View GitHub Pipeline](${config.githubRunUrl})\n\n`;
    }

    testCycle.description += `---\n\n`;
    testCycle.description += `**Build Details:**\n`;
    testCycle.description += `* Branch: ${config.branch}\n`;
    testCycle.description += `* Build Image: ${config.buildImage}\n`;
    testCycle.description += `* Build Number: ${config.buildNumber}\n`;

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
        xmlStats: {
            totalTests,
            totalFailures,
            totalPassed: passedTests,
            passRate,
            totalTime,
        },
    };
}

export async function saveMmctlReport(): Promise<void> {
    // GitHub environment variables
    const branch =
        process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "unknown";
    const githubRepository = process.env.GITHUB_REPOSITORY || "";
    const githubRunId = process.env.GITHUB_RUN_ID || "";
    const githubRunUrl =
        githubRepository && githubRunId
            ? `https://github.com/${githubRepository}/actions/runs/${githubRunId}`
            : undefined;

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

    const { testCycle, testExecutions, xmlStats } = await getTestData(
        reportPath,
        {
            projectKey,
            zephyrFolderId,
            branch,
            buildImage,
            buildNumber,
            githubRunUrl,
        },
    );

    core.info(`Test Cycle: ${testCycle.name}`);
    core.info(
        `Total tests in XML Report: ${xmlStats.totalTests} (${xmlStats.totalPassed} passed, ${xmlStats.totalFailures} failed)`,
    );
    core.info(`MM-T test cases extracted: ${testExecutions.length}`);

    // Create test cycle
    const createCycleResponse = await fetch(`${zephyrCloudApiUrl}/testcycles`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${zephyrApiKey}`,
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(testCycle),
    });

    if (!createCycleResponse.ok) {
        const errorDetails = await createCycleResponse.json();
        core.error(
            `Failed to create test cycle: ${JSON.stringify(errorDetails)}`,
        );
        throw new Error(`HTTP error! Status: ${createCycleResponse.status}`);
    }

    const createdTestCycle = await createCycleResponse.json();
    core.info(`Created test cycle: ${createdTestCycle.key}`);
    core.setOutput("test-cycle-key", createdTestCycle.key);

    // Helper function to save a single test execution with retry logic
    async function saveTestExecution(
        testExecution: TestExecution,
        retries = 3,
    ): Promise<void> {
        testExecution.projectKey = projectKey;
        testExecution.testCycleKey = createdTestCycle.key;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(
                    `${zephyrCloudApiUrl}/testexecutions`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${zephyrApiKey}`,
                            "Content-Type": "application/json; charset=utf-8",
                        },
                        body: JSON.stringify(testExecution),
                    },
                );

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorBody}`);
                }

                await response.json();
                return; // Success, exit function
            } catch (error) {
                const errorMsg =
                    error instanceof Error ? error.message : String(error);
                core.warning(
                    `Error saving test execution for ${testExecution.testCaseKey} (attempt ${attempt}/${retries}): ${errorMsg}`,
                );

                if (attempt === retries) {
                    // Last attempt failed, throw error
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
    }

    const promises = testExecutions.map((testExecution) =>
        saveTestExecution(testExecution)
            .then(() => ({
                success: true,
                testCaseKey: testExecution.testCaseKey,
            }))
            .catch((error) => ({
                success: false,
                testCaseKey: testExecution.testCaseKey,
                error: error.message,
            })),
    );

    const results = await Promise.all(promises);

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
        const summary = core.summary
            .addHeading("mmctl Test Report", 2)
            .addHeading("XML Report Summary (All Tests)", 3)
            .addRaw(`**Total Tests:** ${xmlStats.totalTests}\n\n`)
            .addRaw(`**Passed:** ${xmlStats.totalPassed}\n\n`)
            .addRaw(`**Failed:** ${xmlStats.totalFailures}\n\n`)
            .addRaw(`**Pass Rate:** ${xmlStats.passRate}%\n\n`)
            .addRaw(`**Duration:** ${xmlStats.totalTime.toFixed(1)}s\n\n`)
            .addRaw(`**Branch:** ${branch}\n\n`)
            .addRaw(`**Build Image:** ${buildImage}\n\n`)
            .addRaw(`**Build Number:** ${buildNumber}\n\n`)
            .addHeading("Zephyr Scale Results", 3)
            .addRaw(
                `**Test Cycle:** ${createdTestCycle.key} ${testCycle.name}\n\n`,
            )
            .addRaw(
                `**MM-T test cases extracted:** ${testExecutions.length}\n\n`,
            )
            .addRaw(
                `**Successfully saved:** ${successCount} executions (${uniqueSavedTestKeys.size} unique test keys)\n\n`,
            )
            .addRaw(
                `**Failed to save:** ${failureCount} executions (${uniqueFailedTestKeys.size} unique test keys)\n\n`,
            )
            .addLink(
                "View in Zephyr Scale",
                `https://mattermost.atlassian.net/projects/${projectKey}?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.kanoah.test-manager__main-project-page#!/v2/testCycle/${createdTestCycle.key}`,
            );

        if (savedTestKeys.length > 0) {
            summary
                .addHeading("Saved Test Cases (Details)", 4)
                .addRaw(`**Total Executions:** ${savedTestKeys.length}\n\n`)
                .addRaw(`**Unique Test Keys:** ${uniqueSavedTestKeys.size}\n\n`)
                .addRaw(
                    `<details>\n<summary>View all saved test keys</summary>\n\n`,
                )
                .addRaw(
                    savedTestKeys.map((key: string) => `- ${key}`).join("\n") +
                        "\n\n",
                )
                .addRaw(`</details>\n\n`);
        }

        if (failedTestKeys.length > 0) {
            summary
                .addHeading("Failed Test Cases (Details)", 4)
                .addRaw(`**Total Executions:** ${failedTestKeys.length}\n\n`)
                .addRaw(
                    `**Unique Test Keys:** ${uniqueFailedTestKeys.size}\n\n`,
                )
                .addRaw(
                    `<details>\n<summary>View all failed test keys</summary>\n\n`,
                )
                .addRaw(
                    failedTestKeys.map((key: string) => `- ${key}`).join("\n") +
                        "\n\n",
                )
                .addRaw(`</details>\n\n`);
        }

        await summary.write();
    } else {
        // Log summary info for local testing
        core.info("=== XML Report Summary (All Tests) ===");
        core.info(`Total Tests: ${xmlStats.totalTests}`);
        core.info(`Passed: ${xmlStats.totalPassed}`);
        core.info(`Failed: ${xmlStats.totalFailures}`);
        core.info(`Pass Rate: ${xmlStats.passRate}%`);
        core.info(`Duration: ${xmlStats.totalTime.toFixed(1)}s`);
        core.info(`Branch: ${branch}`);
        core.info(`Build Image: ${buildImage}`);
        core.info(`Build Number: ${buildNumber}`);
        core.info("");
        core.info("=== Zephyr Scale Results ===");
        core.info(`Test Cycle Key: ${createdTestCycle.key}`);
        core.info(`Test Cycle Name: ${testCycle.name}`);
        core.info(`MM-T Test Cases Extracted: ${testExecutions.length}`);
        core.info(
            `Successfully Saved: ${successCount} executions (${uniqueSavedTestKeys.size} unique test keys)`,
        );
        core.info(
            `Failed to Save: ${failureCount} executions (${uniqueFailedTestKeys.size} unique test keys)`,
        );
        core.info("");
        core.info(
            `View in Zephyr: https://mattermost.atlassian.net/projects/${projectKey}?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.kanoah.test-manager__main-project-page#!/v2/testCycle/${createdTestCycle.key}`,
        );
        core.info("");
        core.info(
            `Saved Test Keys (${savedTestKeys.length} total, ${uniqueSavedTestKeys.size} unique): ${savedTestKeys.join(", ")}`,
        );
        if (failedTestKeys.length > 0) {
            core.info(
                `Failed Test Keys (${failedTestKeys.length} total, ${uniqueFailedTestKeys.size} unique): ${failedTestKeys.join(", ")}`,
            );
        }
    }

    // Set outputs
    core.setOutput("test-cycle-key", createdTestCycle.key);
    core.setOutput("test-cycle-success-count", successCount.toString());
    core.setOutput("test-cycle-failure-count", failureCount.toString());

    // XML summary outputs
    core.setOutput("xml-total-tests", xmlStats.totalTests.toString());
    core.setOutput("xml-total-passed", xmlStats.totalPassed.toString());
    core.setOutput("xml-total-failed", xmlStats.totalFailures.toString());
    core.setOutput("xml-pass-rate", xmlStats.passRate);
    core.setOutput("xml-duration", xmlStats.totalTime.toFixed(1));

    // Unique test keys count
    core.setOutput("unique-saved-keys", uniqueSavedTestKeys.size.toString());
    core.setOutput("unique-failed-keys", uniqueFailedTestKeys.size.toString());
}
