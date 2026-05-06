// Classifies JUnit report retries for Server CI PR comments. The classifier only
// reports high-confidence flaky tests: tests with 2-3 failed attempts followed
// by a passing final attempt in the same run.
import {XMLParser} from "fast-xml-parser";

export type TestKey = {
    classname: string;
    name: string;
    file: string;
};

type Attempt = {
    failed: boolean;
    skipped: boolean;
    flakyFailures: number;
};

export type FlakyTest = {
    key: TestKey;
    failedAttempts: number;
};

const failureTags = new Set(["failure", "error"]);
const flakyFailureTags = new Set(["flakyfailure", "flakyerror"]);
const skippedTags = new Set(["skipped"]);

function asArray<T>(value: T | T[] | undefined): T[] {
    if (value === undefined) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function normalizeTestcase(testcase: Record<string, unknown>): Attempt {
    // JUnit marks failed, skipped, and flaky retry attempts as child elements.
    const countChildren = (tags: Set<string>) => {
        return Object.entries(testcase).reduce((count, [key, value]) => {
            if (!tags.has(key.toLowerCase())) {
                return count;
            }

            return count + asArray(value).length;
        }, 0);
    };

    const flakyFailures = countChildren(flakyFailureTags);

    return {
        failed: countChildren(failureTags) > 0,
        skipped: countChildren(skippedTags) > 0,
        flakyFailures,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function collectTestcases(node: unknown): Record<string, unknown>[] {
    if (!isRecord(node)) {
        return [];
    }

    // Reports may be rooted at testsuites, testsuite, or a nested suite tree.
    const ownTestcases = asArray(node.testcase).filter(isRecord);
    const suiteTestcases = asArray(node.testsuite).flatMap((suite) => collectTestcases(suite));
    const suitesTestcases = asArray(node.testsuites).flatMap((suite) => collectTestcases(suite));

    return [...ownTestcases, ...suiteTestcases, ...suitesTestcases];
}

function testcaseKey(testcase: Record<string, unknown>): TestKey {
    return {
        classname: String(testcase.classname ?? ""),
        name: String(testcase.name ?? ""),
        file: String(testcase.file ?? ""),
    };
}

function keyValue(key: TestKey): string {
    return JSON.stringify([key.classname, key.name, key.file]);
}

export function classifyFlakyTests(reportXml: string): FlakyTest[] {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseAttributeValue: false,
        parseTagValue: false,
    });
    const report = parser.parse(reportXml);
    const attemptsByTest = new Map<string, {key: TestKey; attempts: Attempt[]}>();

    for (const testcase of collectTestcases(report)) {
        const key = testcaseKey(testcase);
        const serializedKey = keyValue(key);
        const current = attemptsByTest.get(serializedKey) ?? {key, attempts: []};

        current.attempts.push(normalizeTestcase(testcase));
        attemptsByTest.set(serializedKey, current);
    }

    const flakyTests: FlakyTest[] = [];

    for (const {key, attempts} of attemptsByTest.values()) {
        const finalAttempt = attempts[attempts.length - 1];
        const flakyFailureCount = attempts.reduce((sum, attempt) => sum + attempt.flakyFailures, 0);

        // Only comment when 2-3 failed attempts eventually pass in this run.
        if (flakyFailureCount > 0) {
            if (flakyFailureCount >= 2 && flakyFailureCount <= 3 && !finalAttempt.failed && !finalAttempt.skipped) {
                flakyTests.push({key, failedAttempts: flakyFailureCount});
            }
            continue;
        }

        const failedAttempts = attempts.slice(0, -1).filter((attempt) => attempt.failed).length;
        if (failedAttempts >= 2 && failedAttempts <= 3 && !finalAttempt.failed && !finalAttempt.skipped) {
            flakyTests.push({key, failedAttempts});
        }
    }

    return flakyTests.sort((a, b) => {
        const left = [a.key.classname, a.key.name, a.key.file].join("\0");
        const right = [b.key.classname, b.key.name, b.key.file].join("\0");

        return left.localeCompare(right);
    });
}

function escapeMarkdownCell(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function buildMarkdown(flakyTests: FlakyTest[]): string {
    const rows = [
        "| Test | Class | Failed attempts before pass |",
        "| --- | --- | ---: |",
    ];

    for (const flakyTest of flakyTests) {
        rows.push(
            `| ${escapeMarkdownCell(flakyTest.key.name || "(unknown)")} | ${escapeMarkdownCell(
                flakyTest.key.classname || "(unknown)",
            )} | ${flakyTest.failedAttempts} |`,
        );
    }

    return rows.join("\n");
}
