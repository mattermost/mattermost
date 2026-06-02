import type { RunResult } from "@cursor/sdk";

export interface TesterMarker {
    pass: number;
    fail: number;
    parsed: boolean;
}

const MARKER_RE = /TESTER_COMPLETE:\s*pass=(\d+)\s+fail=(\d+)/i;

/**
 * Parse pass/fail counts from the QA Tester's final message.
 * Unparseable markers are treated as fail=1 (safe default).
 */
export function parseTesterMarker(result: RunResult): TesterMarker {
    const text = result.result ?? "";
    const m = text.match(MARKER_RE);
    if (!m) {
        return { pass: 0, fail: 1, parsed: false };
    }
    return {
        pass: Number(m[1]),
        fail: Number(m[2]),
        parsed: true,
    };
}
