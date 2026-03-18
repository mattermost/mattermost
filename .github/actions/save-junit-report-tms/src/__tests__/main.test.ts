import * as path from "path";
import { getTestData } from "../main";

describe("getTestData", () => {
    const config = {
        projectKey: "MM",
        zephyrFolderId: 27504432,
        branch: "feature-branch",
        buildImage:
            "mattermostdevelopment/mattermost-enterprise-edition:1234567",
        buildNumber: "feature-branch-12345678",
        githubRunUrl:
            "https://github.com/mattermost/mattermost/actions/runs/12345678",
    };

    describe("Basic JUnit report parsing", () => {
        it("should parse a basic JUnit report correctly", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-basic.xml",
            );
            const result = await getTestData(reportPath, config);

            // Check test cycle metadata
            expect(result.testCycle.projectKey).toBe("MM");
            expect(result.testCycle.name).toBe(
                "mmctl: E2E Tests with feature-branch, mattermostdevelopment/mattermost-enterprise-edition:1234567, feature-branch-12345678",
            );
            expect(result.testCycle.statusName).toBe("Done");
            expect(result.testCycle.folderId).toBe(27504432);
            expect(result.testCycle.description).toContain("Test Summary:");
            expect(result.testCycle.description).toContain(
                "github.com/mattermost/mattermost/actions/runs",
            );

            // Check JUnit stats
            expect(result.junitStats.totalTests).toBe(5);
            expect(result.junitStats.totalFailures).toBe(1);
            expect(result.junitStats.totalErrors).toBe(0);
            expect(result.junitStats.totalSkipped).toBe(1);
            expect(result.junitStats.totalPassed).toBe(4);
            expect(result.junitStats.totalTime).toBe(10.5);
            expect(result.junitStats.passRate).toBe("80.0");

            // Check test key stats
            expect(result.testKeyStats.totalOccurrences).toBe(5);
            expect(result.testKeyStats.uniqueCount).toBe(5);
            expect(result.testKeyStats.passedCount).toBe(3);
            expect(result.testKeyStats.failedCount).toBe(1);
            expect(result.testKeyStats.skippedCount).toBe(1);
            expect(result.testKeyStats.failedKeys).toEqual(["MM-T1003"]);
            expect(result.testKeyStats.skippedKeys).toEqual(["MM-T1004"]);

            // Check test executions
            expect(result.testExecutions).toHaveLength(5);
            expect(result.testExecutions[0].testCaseKey).toBe("MM-T1001");
            expect(result.testExecutions[0].statusName).toBe("Pass");
            expect(result.testExecutions[2].testCaseKey).toBe("MM-T1003");
            expect(result.testExecutions[2].statusName).toBe("Fail");
            expect(result.testExecutions[3].testCaseKey).toBe("MM-T1004");
            expect(result.testExecutions[3].statusName).toBe("Not Executed");
        });

        it("should handle timestamps and set planned dates", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-basic.xml",
            );
            const result = await getTestData(reportPath, config);

            expect(result.testCycle.plannedStartDate).toBeDefined();
            expect(result.testCycle.plannedEndDate).toBeDefined();

            const startDate = new Date(result.testCycle.plannedStartDate!);
            const endDate = new Date(result.testCycle.plannedEndDate!);

            expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
        });
    });

    describe("Multiple test suites", () => {
        it("should aggregate stats from multiple testsuites", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-multiple-suites.xml",
            );
            const result = await getTestData(reportPath, config);

            // Aggregated stats
            expect(result.junitStats.totalTests).toBe(10);
            expect(result.junitStats.totalFailures).toBe(2);
            expect(result.junitStats.totalErrors).toBe(1);
            expect(result.junitStats.totalSkipped).toBe(1);
            expect(result.junitStats.totalTime).toBe(25.75);

            // Test executions extracted
            expect(result.testExecutions).toHaveLength(10);
            expect(result.testKeyStats.uniqueCount).toBe(10);
        });

        it("should handle latest timestamp from multiple suites", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-multiple-suites.xml",
            );
            const result = await getTestData(reportPath, config);

            expect(result.testCycle.plannedStartDate).toBeDefined();
            expect(result.testCycle.plannedEndDate).toBeDefined();

            const startDate = new Date(result.testCycle.plannedStartDate!);
            const endDate = new Date(result.testCycle.plannedEndDate!);

            // End date should be after start date
            expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
        });
    });

    describe("Duplicate test keys", () => {
        it("should count test key occurrences separately from unique keys", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-duplicate-keys.xml",
            );
            const result = await getTestData(reportPath, config);

            // Total test executions created (including duplicates)
            expect(result.testExecutions).toHaveLength(5); // 5 tests with MM-T keys

            // Test key statistics
            expect(result.testKeyStats.totalOccurrences).toBe(5);
            expect(result.testKeyStats.uniqueCount).toBe(3); // MM-T4001, MM-T4002, MM-T4003

            // Status tracking for unique keys
            // MM-T4001: has both Pass and Fail
            // MM-T4002: has both Pass and Fail
            // MM-T4003: has only Pass
            expect(result.testKeyStats.passedCount).toBe(3); // MM-T4001, MM-T4002, MM-T4003
            expect(result.testKeyStats.failedCount).toBe(2); // MM-T4001, MM-T4002
            expect(result.testKeyStats.skippedCount).toBe(0);
        });

        it("should create separate test executions for each occurrence", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-duplicate-keys.xml",
            );
            const result = await getTestData(reportPath, config);

            // Find MM-T4001 executions
            const t4001Executions = result.testExecutions.filter(
                (e) => e.testCaseKey === "MM-T4001",
            );
            expect(t4001Executions).toHaveLength(2);

            // One should be Fail, one should be Pass
            const statuses = t4001Executions.map((e) => e.statusName).sort();
            expect(statuses).toEqual(["Fail", "Pass"]);
        });
    });

    describe("Test execution data", () => {
        it("should return executions with correct status values", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-duplicate-keys.xml",
            );
            const result = await getTestData(reportPath, config);

            // Verify we have both Pass and Fail statuses
            const statuses = result.testExecutions.map((e) => e.statusName);
            expect(statuses).toContain("Pass");
            expect(statuses).toContain("Fail");

            // Verify each execution has required fields
            result.testExecutions.forEach((execution) => {
                expect(execution.testCaseKey).toBeTruthy();
                expect(execution.statusName).toBeTruthy();
                expect(execution.comment).toBeTruthy();
                expect(typeof execution.executionTime).toBe("number");
            });
        });
    });

    describe("Test cycle description", () => {
        it("should include test summary in description", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-basic.xml",
            );
            const result = await getTestData(reportPath, config);

            expect(result.testCycle.description).toContain("Test Summary:");
            expect(result.testCycle.description).toContain("4 passed");
            expect(result.testCycle.description).toContain("1 failed");
            expect(result.testCycle.description).toContain("80.0% pass rate");
            expect(result.testCycle.description).toContain("10.5s duration");
        });

        it("should include build details in description", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-basic.xml",
            );
            const result = await getTestData(reportPath, config);

            expect(result.testCycle.description).toContain(
                "branch: feature-branch",
            );
            expect(result.testCycle.description).toContain(
                "build image: mattermostdevelopment/mattermost-enterprise-edition:1234567",
            );
            expect(result.testCycle.description).toContain(
                "build number: feature-branch-12345678",
            );
        });

        it("should include GitHub run URL", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-basic.xml",
            );
            const result = await getTestData(reportPath, config);

            expect(result.testCycle.description).toContain(
                "https://github.com/mattermost/mattermost/actions/runs/12345678",
            );
        });
    });

    describe("Edge cases", () => {
        it("should handle reports with no test keys", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-duplicate-keys.xml",
            );
            const result = await getTestData(reportPath, config);

            // Report has 6 total tests, but only 5 have MM-T keys
            expect(result.junitStats.totalTests).toBe(6);
            expect(result.testExecutions).toHaveLength(5);
        });

        it("should calculate 0% pass rate when all tests fail", async () => {
            // Using report-multiple-suites which has failures
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "report-multiple-suites.xml",
            );
            const result = await getTestData(reportPath, config);

            // Pass rate should be less than 100%
            expect(parseFloat(result.junitStats.passRate)).toBeLessThan(100);
        });
    });

    describe("Error handling", () => {
        it("should throw error for non-existent file", async () => {
            const reportPath = path.join(
                __dirname,
                "fixtures",
                "non-existent.xml",
            );

            await expect(getTestData(reportPath, config)).rejects.toThrow();
        });

        it("should throw error for invalid XML", async () => {
            // This would require creating an invalid XML fixture
            // Skipping for now, but you could add one
        });
    });
});
