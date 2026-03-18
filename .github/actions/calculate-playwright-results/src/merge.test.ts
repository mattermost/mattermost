import { mergeResults, computeStats, calculateResults } from "./merge";
import type { PlaywrightResults, Suite } from "./types";

describe("mergeResults", () => {
    const createSuite = (file: string, tests: { status: string }[]): Suite => ({
        title: file,
        file,
        column: 0,
        line: 0,
        specs: [
            {
                title: "test spec",
                ok: true,
                tags: [],
                tests: tests.map((t) => ({
                    timeout: 60000,
                    annotations: [],
                    expectedStatus: "passed",
                    projectId: "chrome",
                    projectName: "chrome",
                    results: [
                        {
                            workerIndex: 0,
                            parallelIndex: 0,
                            status: t.status,
                            duration: 1000,
                            errors: [],
                            stdout: [],
                            stderr: [],
                            retry: 0,
                            startTime: new Date().toISOString(),
                            annotations: [],
                        },
                    ],
                })),
            },
        ],
    });

    it("should keep original suites not in retest", () => {
        const original: PlaywrightResults = {
            config: {},
            suites: [
                createSuite("spec1.ts", [{ status: "passed" }]),
                createSuite("spec2.ts", [{ status: "failed" }]),
                createSuite("spec3.ts", [{ status: "passed" }]),
            ],
            stats: {
                startTime: new Date().toISOString(),
                duration: 10000,
                expected: 2,
                unexpected: 1,
                skipped: 0,
                flaky: 0,
            },
        };

        const retest: PlaywrightResults = {
            config: {},
            suites: [createSuite("spec2.ts", [{ status: "passed" }])],
            stats: {
                startTime: new Date().toISOString(),
                duration: 5000,
                expected: 1,
                unexpected: 0,
                skipped: 0,
                flaky: 0,
            },
        };

        const result = mergeResults(original, retest);

        expect(result.totalSuites).toBe(3);
        expect(result.retestFiles).toEqual(["spec2.ts"]);
        expect(result.merged.suites.map((s) => s.file)).toEqual([
            "spec1.ts",
            "spec3.ts",
            "spec2.ts",
        ]);
    });

    it("should compute correct stats from merged suites", () => {
        const original: PlaywrightResults = {
            config: {},
            suites: [
                createSuite("spec1.ts", [{ status: "passed" }]),
                createSuite("spec2.ts", [{ status: "failed" }]),
            ],
            stats: {
                startTime: new Date().toISOString(),
                duration: 10000,
                expected: 1,
                unexpected: 1,
                skipped: 0,
                flaky: 0,
            },
        };

        const retest: PlaywrightResults = {
            config: {},
            suites: [createSuite("spec2.ts", [{ status: "passed" }])],
            stats: {
                startTime: new Date().toISOString(),
                duration: 5000,
                expected: 1,
                unexpected: 0,
                skipped: 0,
                flaky: 0,
            },
        };

        const result = mergeResults(original, retest);

        expect(result.stats.expected).toBe(2);
        expect(result.stats.unexpected).toBe(0);
        expect(result.stats.duration).toBe(15000);
    });
});

describe("computeStats", () => {
    it("should count flaky tests correctly", () => {
        const suites: Suite[] = [
            {
                title: "spec1.ts",
                file: "spec1.ts",
                column: 0,
                line: 0,
                specs: [
                    {
                        title: "flaky test",
                        ok: true,
                        tags: [],
                        tests: [
                            {
                                timeout: 60000,
                                annotations: [],
                                expectedStatus: "passed",
                                projectId: "chrome",
                                projectName: "chrome",
                                results: [
                                    {
                                        workerIndex: 0,
                                        parallelIndex: 0,
                                        status: "failed",
                                        duration: 1000,
                                        errors: [],
                                        stdout: [],
                                        stderr: [],
                                        retry: 0,
                                        startTime: new Date().toISOString(),
                                        annotations: [],
                                    },
                                    {
                                        workerIndex: 0,
                                        parallelIndex: 0,
                                        status: "passed",
                                        duration: 1000,
                                        errors: [],
                                        stdout: [],
                                        stderr: [],
                                        retry: 1,
                                        startTime: new Date().toISOString(),
                                        annotations: [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ];

        const stats = computeStats(suites);

        expect(stats.expected).toBe(0);
        expect(stats.flaky).toBe(1);
        expect(stats.unexpected).toBe(0);
    });
});

describe("calculateResults", () => {
    const createSuiteWithSpec = (
        file: string,
        specTitle: string,
        testResults: { status: string; retry: number }[],
    ): Suite => ({
        title: file,
        file,
        column: 0,
        line: 0,
        specs: [
            {
                title: specTitle,
                ok: testResults[testResults.length - 1].status === "passed",
                tags: [],
                tests: [
                    {
                        timeout: 60000,
                        annotations: [],
                        expectedStatus: "passed",
                        projectId: "chrome",
                        projectName: "chrome",
                        results: testResults.map((r) => ({
                            workerIndex: 0,
                            parallelIndex: 0,
                            status: r.status,
                            duration: 1000,
                            errors:
                                r.status === "failed"
                                    ? [{ message: "error" }]
                                    : [],
                            stdout: [],
                            stderr: [],
                            retry: r.retry,
                            startTime: new Date().toISOString(),
                            annotations: [],
                        })),
                        location: {
                            file,
                            line: 10,
                            column: 5,
                        },
                    },
                ],
            },
        ],
    });

    it("should calculate all outputs correctly for passing results", () => {
        const results: PlaywrightResults = {
            config: {},
            suites: [
                createSuiteWithSpec("login.spec.ts", "should login", [
                    { status: "passed", retry: 0 },
                ]),
                createSuiteWithSpec(
                    "messaging.spec.ts",
                    "should send message",
                    [{ status: "passed", retry: 0 }],
                ),
            ],
            stats: {
                startTime: new Date().toISOString(),
                duration: 5000,
                expected: 2,
                unexpected: 0,
                skipped: 0,
                flaky: 0,
            },
        };

        const calc = calculateResults(results);

        expect(calc.passed).toBe(2);
        expect(calc.failed).toBe(0);
        expect(calc.flaky).toBe(0);
        expect(calc.skipped).toBe(0);
        expect(calc.total).toBe(2);
        expect(calc.passing).toBe(2);
        expect(calc.passRate).toBe("100.00");
        expect(calc.color).toBe("#43A047"); // green
        expect(calc.totalSpecs).toBe(2);
        expect(calc.failedSpecs).toBe("");
        expect(calc.failedSpecsCount).toBe(0);
        expect(calc.commitStatusMessage).toBe("100% passed (2), 2 specs");
    });

    it("should calculate all outputs correctly for results with failures", () => {
        const results: PlaywrightResults = {
            config: {},
            suites: [
                createSuiteWithSpec("login.spec.ts", "should login", [
                    { status: "passed", retry: 0 },
                ]),
                createSuiteWithSpec(
                    "channels.spec.ts",
                    "should create channel",
                    [
                        { status: "failed", retry: 0 },
                        { status: "failed", retry: 1 },
                        { status: "failed", retry: 2 },
                    ],
                ),
            ],
            stats: {
                startTime: new Date().toISOString(),
                duration: 10000,
                expected: 1,
                unexpected: 1,
                skipped: 0,
                flaky: 0,
            },
        };

        const calc = calculateResults(results);

        expect(calc.passed).toBe(1);
        expect(calc.failed).toBe(1);
        expect(calc.flaky).toBe(0);
        expect(calc.total).toBe(2);
        expect(calc.passing).toBe(1);
        expect(calc.passRate).toBe("50.00");
        expect(calc.color).toBe("#F44336"); // red
        expect(calc.totalSpecs).toBe(2);
        expect(calc.failedSpecs).toBe("channels.spec.ts");
        expect(calc.failedSpecsCount).toBe(1);
        expect(calc.commitStatusMessage).toBe(
            "50.0% passed (1/2), 1 failed, 2 specs",
        );
        expect(calc.failedTests).toContain("should create channel");
    });
});

describe("full integration: original with failure, retest passes", () => {
    const createSuiteWithSpec = (
        file: string,
        specTitle: string,
        testResults: { status: string; retry: number }[],
    ): Suite => ({
        title: file,
        file,
        column: 0,
        line: 0,
        specs: [
            {
                title: specTitle,
                ok: testResults[testResults.length - 1].status === "passed",
                tags: [],
                tests: [
                    {
                        timeout: 60000,
                        annotations: [],
                        expectedStatus: "passed",
                        projectId: "chrome",
                        projectName: "chrome",
                        results: testResults.map((r) => ({
                            workerIndex: 0,
                            parallelIndex: 0,
                            status: r.status,
                            duration: 1000,
                            errors:
                                r.status === "failed"
                                    ? [{ message: "error" }]
                                    : [],
                            stdout: [],
                            stderr: [],
                            retry: r.retry,
                            startTime: new Date().toISOString(),
                            annotations: [],
                        })),
                        location: {
                            file,
                            line: 10,
                            column: 5,
                        },
                    },
                ],
            },
        ],
    });

    it("should merge and calculate correctly when failed test passes on retest", () => {
        // Original: 2 passed, 1 failed (channels.spec.ts)
        const original: PlaywrightResults = {
            config: {},
            suites: [
                createSuiteWithSpec("login.spec.ts", "should login", [
                    { status: "passed", retry: 0 },
                ]),
                createSuiteWithSpec(
                    "messaging.spec.ts",
                    "should send message",
                    [{ status: "passed", retry: 0 }],
                ),
                createSuiteWithSpec(
                    "channels.spec.ts",
                    "should create channel",
                    [
                        { status: "failed", retry: 0 },
                        { status: "failed", retry: 1 },
                        { status: "failed", retry: 2 },
                    ],
                ),
            ],
            stats: {
                startTime: new Date().toISOString(),
                duration: 18000,
                expected: 2,
                unexpected: 1,
                skipped: 0,
                flaky: 0,
            },
        };

        // Retest: channels.spec.ts now passes
        const retest: PlaywrightResults = {
            config: {},
            suites: [
                createSuiteWithSpec(
                    "channels.spec.ts",
                    "should create channel",
                    [{ status: "passed", retry: 0 }],
                ),
            ],
            stats: {
                startTime: new Date().toISOString(),
                duration: 3000,
                expected: 1,
                unexpected: 0,
                skipped: 0,
                flaky: 0,
            },
        };

        // Step 1: Verify original has failure
        const originalCalc = calculateResults(original);
        expect(originalCalc.passed).toBe(2);
        expect(originalCalc.failed).toBe(1);
        expect(originalCalc.passRate).toBe("66.67");

        // Step 2: Merge results
        const mergeResult = mergeResults(original, retest);

        // Step 3: Verify merge structure
        expect(mergeResult.totalSuites).toBe(3);
        expect(mergeResult.retestFiles).toEqual(["channels.spec.ts"]);
        expect(mergeResult.merged.suites.map((s) => s.file)).toEqual([
            "login.spec.ts",
            "messaging.spec.ts",
            "channels.spec.ts",
        ]);

        // Step 4: Calculate final results
        const finalCalc = calculateResults(mergeResult.merged);

        // Step 5: Verify all outputs
        expect(finalCalc.passed).toBe(3);
        expect(finalCalc.failed).toBe(0);
        expect(finalCalc.flaky).toBe(0);
        expect(finalCalc.skipped).toBe(0);
        expect(finalCalc.total).toBe(3);
        expect(finalCalc.passing).toBe(3);
        expect(finalCalc.passRate).toBe("100.00");
        expect(finalCalc.color).toBe("#43A047"); // green
        expect(finalCalc.totalSpecs).toBe(3);
        expect(finalCalc.failedSpecs).toBe("");
        expect(finalCalc.failedSpecsCount).toBe(0);
        expect(finalCalc.commitStatusMessage).toBe("100% passed (3), 3 specs");
        expect(finalCalc.failedTests).toBe("");
    });

    it("should handle case where retest still fails", () => {
        // Original: 2 passed, 1 failed
        const original: PlaywrightResults = {
            config: {},
            suites: [
                createSuiteWithSpec("login.spec.ts", "should login", [
                    { status: "passed", retry: 0 },
                ]),
                createSuiteWithSpec(
                    "channels.spec.ts",
                    "should create channel",
                    [{ status: "failed", retry: 0 }],
                ),
            ],
            stats: {
                startTime: new Date().toISOString(),
                duration: 10000,
                expected: 1,
                unexpected: 1,
                skipped: 0,
                flaky: 0,
            },
        };

        // Retest: channels.spec.ts still fails
        const retest: PlaywrightResults = {
            config: {},
            suites: [
                createSuiteWithSpec(
                    "channels.spec.ts",
                    "should create channel",
                    [
                        { status: "failed", retry: 0 },
                        { status: "failed", retry: 1 },
                    ],
                ),
            ],
            stats: {
                startTime: new Date().toISOString(),
                duration: 5000,
                expected: 0,
                unexpected: 1,
                skipped: 0,
                flaky: 0,
            },
        };

        const mergeResult = mergeResults(original, retest);
        const finalCalc = calculateResults(mergeResult.merged);

        expect(finalCalc.passed).toBe(1);
        expect(finalCalc.failed).toBe(1);
        expect(finalCalc.passRate).toBe("50.00");
        expect(finalCalc.color).toBe("#F44336"); // red
        expect(finalCalc.failedSpecs).toBe("channels.spec.ts");
        expect(finalCalc.failedSpecsCount).toBe(1);
    });
});
