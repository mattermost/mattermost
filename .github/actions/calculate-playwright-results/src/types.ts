export interface PlaywrightResults {
    config: Record<string, unknown>;
    suites: Suite[];
    stats?: Stats;
}

export interface Suite {
    title: string;
    file: string;
    column: number;
    line: number;
    specs: Spec[];
    suites?: Suite[];
}

export interface Spec {
    title: string;
    ok: boolean;
    tags: string[];
    tests: Test[];
}

export interface Test {
    timeout: number;
    annotations: unknown[];
    expectedStatus: string;
    projectId: string;
    projectName: string;
    results: TestResult[];
    location?: TestLocation;
}

export interface TestResult {
    workerIndex: number;
    parallelIndex: number;
    status: string;
    duration: number;
    errors: unknown[];
    stdout: unknown[];
    stderr: unknown[];
    retry: number;
    startTime: string;
    annotations: unknown[];
    attachments?: unknown[];
}

export interface TestLocation {
    file: string;
    line: number;
    column: number;
}

export interface Stats {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    skipped: number;
    flaky: number;
}

export interface MergeResult {
    merged: PlaywrightResults;
    stats: Stats;
    totalSuites: number;
    retestFiles: string[];
}

export interface CalculationResult {
    passed: number;
    failed: number;
    flaky: number;
    skipped: number;
    totalSpecs: number;
    commitStatusMessage: string;
    failedSpecs: string;
    failedSpecsCount: number;
    failedTests: string;
    total: number;
    passRate: string;
    passing: number;
    color: string;
}

export interface FailedTest {
    title: string;
    file: string;
}
