import { sortTestExecutions } from "../main";
import type { TestExecution } from "../types";

describe("sortTestExecutions", () => {
    it("should sort by status first (Pass, Fail, Not Executed)", () => {
        const executions: TestExecution[] = [
            {
                testCaseKey: "MM-T1003",
                statusName: "Fail",
                executionTime: 3.0,
                comment: "Test 3",
            },
            {
                testCaseKey: "MM-T1001",
                statusName: "Pass",
                executionTime: 1.0,
                comment: "Test 1",
            },
            {
                testCaseKey: "MM-T1004",
                statusName: "Not Executed",
                executionTime: 4.0,
                comment: "Test 4",
            },
            {
                testCaseKey: "MM-T1002",
                statusName: "Pass",
                executionTime: 2.0,
                comment: "Test 2",
            },
        ];

        const sorted = sortTestExecutions(executions);

        // All Pass should come first
        expect(sorted[0].statusName).toBe("Pass");
        expect(sorted[1].statusName).toBe("Pass");
        // Then Fail
        expect(sorted[2].statusName).toBe("Fail");
        // Then Not Executed
        expect(sorted[3].statusName).toBe("Not Executed");
    });

    it("should sort by test key within same status", () => {
        const executions: TestExecution[] = [
            {
                testCaseKey: "MM-T1003",
                statusName: "Pass",
                executionTime: 3.0,
                comment: "Test 3",
            },
            {
                testCaseKey: "MM-T1001",
                statusName: "Pass",
                executionTime: 1.0,
                comment: "Test 1",
            },
            {
                testCaseKey: "MM-T1002",
                statusName: "Pass",
                executionTime: 2.0,
                comment: "Test 2",
            },
        ];

        const sorted = sortTestExecutions(executions);

        expect(sorted[0].testCaseKey).toBe("MM-T1001");
        expect(sorted[1].testCaseKey).toBe("MM-T1002");
        expect(sorted[2].testCaseKey).toBe("MM-T1003");
    });

    it("should not mutate the original array", () => {
        const executions: TestExecution[] = [
            {
                testCaseKey: "MM-T1002",
                statusName: "Fail",
                executionTime: 2.0,
                comment: "Test 2",
            },
            {
                testCaseKey: "MM-T1001",
                statusName: "Pass",
                executionTime: 1.0,
                comment: "Test 1",
            },
        ];

        const sorted = sortTestExecutions(executions);

        // Original array should remain unchanged
        expect(executions[0].testCaseKey).toBe("MM-T1002");
        expect(sorted[0].testCaseKey).toBe("MM-T1001");
    });

    it("should handle empty array", () => {
        const sorted = sortTestExecutions([]);
        expect(sorted).toEqual([]);
    });

    it("should handle single item", () => {
        const executions: TestExecution[] = [
            {
                testCaseKey: "MM-T1001",
                statusName: "Pass",
                executionTime: 1.0,
                comment: "Test 1",
            },
        ];

        const sorted = sortTestExecutions(executions);
        expect(sorted).toEqual(executions);
    });
});
