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

function asArray<T>(value: T | T[] | undefined): T[] {
    if (value === undefined) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function normalizeTestcase(testcase: Record<string, unknown>): Attempt {
    const childTags = Object.keys(testcase).map((key) => key.toLowerCase());
    const flakyFailures = childTags.reduce((count, tag) => {
        if (!flakyFailureTags.has(tag)) {
            return count;
        }

        const matchingKey = Object.keys(testcase).find((key) => key.toLowerCase() === tag);
        return count + asArray(matchingKey ? testcase[matchingKey] : undefined).length;
    }, 0);

    return {
        failed: childTags.some((tag) => failureTags.has(tag)),
        skipped: childTags.includes("skipped"),
        flakyFailures,
    };
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

function collectTestcases(node: unknown): Record<string, unknown>[] {
    if (!node || typeof node !== "object") {
        return [];
    }

    const record = node as Record<string, unknown>;
    const ownTestcases = asArray(record.testcase).filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
    );
    const suiteTestcases = asArray(record.testsuite).flatMap((suite) => collectTestcases(suite));
    const suitesTestcases = asArray(record.testsuites).flatMap((suite) => collectTestcases(suite));

    return [...ownTestcases, ...suiteTestcases, ...suitesTestcases];
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
