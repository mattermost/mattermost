import { calculateResultsFromSpecs } from "./merge";
import type { ParsedSpecFile, MochawesomeResult } from "./types";

/**
 * Helper to create a mochawesome result for testing
 */
function createMochawesomeResult(
    specFile: string,
    tests: { title: string; state: "passed" | "failed" | "pending" }[],
): MochawesomeResult {
    return {
        stats: {
            suites: 1,
            tests: tests.length,
            passes: tests.filter((t) => t.state === "passed").length,
            pending: tests.filter((t) => t.state === "pending").length,
            failures: tests.filter((t) => t.state === "failed").length,
            start: new Date().toISOString(),
            end: new Date().toISOString(),
            duration: 1000,
            testsRegistered: tests.length,
            passPercent: 0,
            pendingPercent: 0,
            other: 0,
            hasOther: false,
            skipped: 0,
            hasSkipped: false,
        },
        results: [
            {
                uuid: "uuid-1",
                title: specFile,
                fullFile: `/app/e2e-tests/cypress/tests/integration/${specFile}`,
                file: `tests/integration/${specFile}`,
                beforeHooks: [],
                afterHooks: [],
                tests: tests.map((t, i) => ({
                    title: t.title,
                    fullTitle: `${specFile} > ${t.title}`,
                    timedOut: null,
                    duration: 500,
                    state: t.state,
                    speed: "fast",
                    pass: t.state === "passed",
                    fail: t.state === "failed",
                    pending: t.state === "pending",
                    context: null,
                    code: "",
                    err: t.state === "failed" ? { message: "Test failed" } : {},
                    uuid: `test-uuid-${i}`,
                    parentUUID: "uuid-1",
                    isHook: false,
                    skipped: false,
                })),
                suites: [],
                passes: tests
                    .filter((t) => t.state === "passed")
                    .map((_, i) => `test-uuid-${i}`),
                failures: tests
                    .filter((t) => t.state === "failed")
                    .map((_, i) => `test-uuid-${i}`),
                pending: tests
                    .filter((t) => t.state === "pending")
                    .map((_, i) => `test-uuid-${i}`),
                skipped: [],
                duration: 1000,
                root: true,
                rootEmpty: false,
                _timeout: 60000,
            },
        ],
    };
}

function createParsedSpecFile(
    specFile: string,
    tests: { title: string; state: "passed" | "failed" | "pending" }[],
): ParsedSpecFile {
    return {
        filePath: `/path/to/${specFile}.json`,
        specPath: `tests/integration/${specFile}`,
        result: createMochawesomeResult(specFile, tests),
    };
}

describe("calculateResultsFromSpecs", () => {
    it("should calculate all outputs correctly for passing results", () => {
        const specs: ParsedSpecFile[] = [
            createParsedSpecFile("login.spec.ts", [
                {
                    title: "should login with valid credentials",
                    state: "passed",
                },
            ]),
            createParsedSpecFile("messaging.spec.ts", [
                { title: "should send a message", state: "passed" },
            ]),
        ];

        const calc = calculateResultsFromSpecs(specs);

        expect(calc.passed).toBe(2);
        expect(calc.failed).toBe(0);
        expect(calc.pending).toBe(0);
        expect(calc.total).toBe(2);
        expect(calc.passRate).toBe("100.00");
        expect(calc.color).toBe("#43A047"); // green
        expect(calc.totalSpecs).toBe(2);
        expect(calc.failedSpecs).toBe("");
        expect(calc.failedSpecsCount).toBe(0);
        expect(calc.commitStatusMessage).toBe("100% passed (2), 2 specs");
    });

    it("should calculate all outputs correctly for results with failures", () => {
        const specs: ParsedSpecFile[] = [
            createParsedSpecFile("login.spec.ts", [
                {
                    title: "should login with valid credentials",
                    state: "passed",
                },
            ]),
            createParsedSpecFile("channels.spec.ts", [
                { title: "should create a channel", state: "failed" },
            ]),
        ];

        const calc = calculateResultsFromSpecs(specs);

        expect(calc.passed).toBe(1);
        expect(calc.failed).toBe(1);
        expect(calc.pending).toBe(0);
        expect(calc.total).toBe(2);
        expect(calc.passRate).toBe("50.00");
        expect(calc.color).toBe("#F44336"); // red
        expect(calc.totalSpecs).toBe(2);
        expect(calc.failedSpecs).toBe("tests/integration/channels.spec.ts");
        expect(calc.failedSpecsCount).toBe(1);
        expect(calc.commitStatusMessage).toBe(
            "50.0% passed (1/2), 1 failed, 2 specs",
        );
        expect(calc.failedTests).toContain("should create a channel");
    });

    it("should handle pending tests correctly", () => {
        const specs: ParsedSpecFile[] = [
            createParsedSpecFile("login.spec.ts", [
                { title: "should login", state: "passed" },
                { title: "should logout", state: "pending" },
            ]),
        ];

        const calc = calculateResultsFromSpecs(specs);

        expect(calc.passed).toBe(1);
        expect(calc.failed).toBe(0);
        expect(calc.pending).toBe(1);
        expect(calc.total).toBe(1); // Total excludes pending
        expect(calc.passRate).toBe("100.00");
    });

    it("should limit failed tests to 10 entries", () => {
        const specs: ParsedSpecFile[] = [
            createParsedSpecFile("big-test.spec.ts", [
                { title: "test 1", state: "failed" },
                { title: "test 2", state: "failed" },
                { title: "test 3", state: "failed" },
                { title: "test 4", state: "failed" },
                { title: "test 5", state: "failed" },
                { title: "test 6", state: "failed" },
                { title: "test 7", state: "failed" },
                { title: "test 8", state: "failed" },
                { title: "test 9", state: "failed" },
                { title: "test 10", state: "failed" },
                { title: "test 11", state: "failed" },
                { title: "test 12", state: "failed" },
            ]),
        ];

        const calc = calculateResultsFromSpecs(specs);

        expect(calc.failed).toBe(12);
        expect(calc.failedTests).toContain("...and 2 more failed tests");
    });
});

describe("merge simulation", () => {
    it("should produce correct results when merging original with retest", () => {
        // Simulate original: 2 passed, 1 failed
        const originalSpecs: ParsedSpecFile[] = [
            createParsedSpecFile("login.spec.ts", [
                { title: "should login", state: "passed" },
            ]),
            createParsedSpecFile("messaging.spec.ts", [
                { title: "should send message", state: "passed" },
            ]),
            createParsedSpecFile("channels.spec.ts", [
                { title: "should create channel", state: "failed" },
            ]),
        ];

        // Verify original has failure
        const originalCalc = calculateResultsFromSpecs(originalSpecs);
        expect(originalCalc.passed).toBe(2);
        expect(originalCalc.failed).toBe(1);
        expect(originalCalc.passRate).toBe("66.67");

        // Simulate retest: channels.spec.ts now passes
        const retestSpec = createParsedSpecFile("channels.spec.ts", [
            { title: "should create channel", state: "passed" },
        ]);

        // Simulate merge: replace original channels.spec.ts with retest
        const specMap = new Map<string, ParsedSpecFile>();
        for (const spec of originalSpecs) {
            specMap.set(spec.specPath, spec);
        }
        specMap.set(retestSpec.specPath, retestSpec);

        const mergedSpecs = Array.from(specMap.values());

        // Calculate final results
        const finalCalc = calculateResultsFromSpecs(mergedSpecs);

        expect(finalCalc.passed).toBe(3);
        expect(finalCalc.failed).toBe(0);
        expect(finalCalc.pending).toBe(0);
        expect(finalCalc.total).toBe(3);
        expect(finalCalc.passRate).toBe("100.00");
        expect(finalCalc.color).toBe("#43A047"); // green
        expect(finalCalc.totalSpecs).toBe(3);
        expect(finalCalc.failedSpecs).toBe("");
        expect(finalCalc.failedSpecsCount).toBe(0);
        expect(finalCalc.commitStatusMessage).toBe("100% passed (3), 3 specs");
    });

    it("should handle case where retest still fails", () => {
        // Original: 1 passed, 1 failed
        const originalSpecs: ParsedSpecFile[] = [
            createParsedSpecFile("login.spec.ts", [
                { title: "should login", state: "passed" },
            ]),
            createParsedSpecFile("channels.spec.ts", [
                { title: "should create channel", state: "failed" },
            ]),
        ];

        // Retest: channels.spec.ts still fails
        const retestSpec = createParsedSpecFile("channels.spec.ts", [
            { title: "should create channel", state: "failed" },
        ]);

        // Merge
        const specMap = new Map<string, ParsedSpecFile>();
        for (const spec of originalSpecs) {
            specMap.set(spec.specPath, spec);
        }
        specMap.set(retestSpec.specPath, retestSpec);

        const mergedSpecs = Array.from(specMap.values());
        const finalCalc = calculateResultsFromSpecs(mergedSpecs);

        expect(finalCalc.passed).toBe(1);
        expect(finalCalc.failed).toBe(1);
        expect(finalCalc.passRate).toBe("50.00");
        expect(finalCalc.color).toBe("#F44336"); // red
        expect(finalCalc.failedSpecs).toBe(
            "tests/integration/channels.spec.ts",
        );
        expect(finalCalc.failedSpecsCount).toBe(1);
    });
});
