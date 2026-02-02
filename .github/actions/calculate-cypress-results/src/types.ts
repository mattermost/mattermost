/**
 * Mochawesome result structure for a single spec file
 */
export interface MochawesomeResult {
    stats: MochawesomeStats;
    results: ResultItem[];
}

export interface MochawesomeStats {
    suites: number;
    tests: number;
    passes: number;
    pending: number;
    failures: number;
    start: string;
    end: string;
    duration: number;
    testsRegistered: number;
    passPercent: number;
    pendingPercent: number;
    other: number;
    hasOther: boolean;
    skipped: number;
    hasSkipped: boolean;
}

export interface ResultItem {
    uuid: string;
    title: string;
    fullFile: string;
    file: string;
    beforeHooks: Hook[];
    afterHooks: Hook[];
    tests: TestItem[];
    suites: SuiteItem[];
    passes: string[];
    failures: string[];
    pending: string[];
    skipped: string[];
    duration: number;
    root: boolean;
    rootEmpty: boolean;
    _timeout: number;
}

export interface SuiteItem {
    uuid: string;
    title: string;
    fullFile: string;
    file: string;
    beforeHooks: Hook[];
    afterHooks: Hook[];
    tests: TestItem[];
    suites: SuiteItem[];
    passes: string[];
    failures: string[];
    pending: string[];
    skipped: string[];
    duration: number;
    root: boolean;
    rootEmpty: boolean;
    _timeout: number;
}

export interface TestItem {
    title: string;
    fullTitle: string;
    timedOut: boolean | null;
    duration: number;
    state: "passed" | "failed" | "pending";
    speed: string | null;
    pass: boolean;
    fail: boolean;
    pending: boolean;
    context: string | null;
    code: string;
    err: TestError;
    uuid: string;
    parentUUID: string;
    isHook: boolean;
    skipped: boolean;
}

export interface TestError {
    message?: string;
    estack?: string;
    diff?: string | null;
}

export interface Hook {
    title: string;
    fullTitle: string;
    timedOut: boolean | null;
    duration: number;
    state: string | null;
    speed: string | null;
    pass: boolean;
    fail: boolean;
    pending: boolean;
    context: string | null;
    code: string;
    err: TestError;
    uuid: string;
    parentUUID: string;
    isHook: boolean;
    skipped: boolean;
}

/**
 * Parsed spec file with its path and results
 */
export interface ParsedSpecFile {
    filePath: string;
    specPath: string;
    result: MochawesomeResult;
}

/**
 * Calculation result outputs
 */
export interface CalculationResult {
    passed: number;
    failed: number;
    pending: number;
    totalSpecs: number;
    commitStatusMessage: string;
    failedSpecs: string;
    failedSpecsCount: number;
    failedTests: string;
    total: number;
    passRate: string;
    color: string;
}

export interface FailedTest {
    title: string;
    file: string;
}
