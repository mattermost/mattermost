export interface TestExecution {
    testCaseKey: string;
    statusName: string;
    executionTime: number;
    comment: string;
    projectKey?: string;
    testCycleKey?: string;
}

export interface TestCycle {
    projectKey: string;
    name: string;
    description: string;
    statusName: string;
    folderId: number;
    plannedStartDate?: string;
    plannedEndDate?: string;
    customFields?: Record<string, any>;
}

export interface TestData {
    testCycle: TestCycle;
    testExecutions: TestExecution[];
    junitStats: {
        totalTests: number;
        totalFailures: number;
        totalErrors: number;
        totalSkipped: number;
        totalPassed: number;
        passRate: string;
        totalTime: number;
    };
    testKeyStats: {
        totalOccurrences: number;
        uniqueCount: number;
        passedCount: number;
        failedCount: number;
        skippedCount: number;
        failedKeys: string[];
        skippedKeys: string[];
    };
}

export interface ZephyrApiClient {
    createTestCycle(testCycle: TestCycle): Promise<{ key: string }>;
    saveTestExecution(
        testExecution: TestExecution,
        retries?: number,
    ): Promise<void>;
}
