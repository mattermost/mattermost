// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';

import type {Scrubber} from './scrub.ts';

export type Finding = {
    oracle: string;
    class: string;
    path: string;
    evidence: string;
    count: number;
    first_action: number;
};

export type FindingInput = {
    oracle: string;
    class: string;
    /** Raw URL or path; scrubbed by the sink. */
    path: string;
    /** Raw evidence text; scrubbed by the sink. */
    evidence: string;
    action: number;
    weight?: number;
    /** State oracles: count the finding once per checkpoint, however many elements show it. */
    perCheckpoint?: boolean;
    /** Used only to match allowlist entries; never written out. */
    meta?: {method?: string; status?: number};
};

export type AllowEntry = {
    id?: string;
    oracle?: string;
    class?: string;
    path_glob?: string;
    evidence_regex?: string;
    method?: string;
    statuses?: number[];
    reason: string;
};

export type Allowlist = {schema: 'explorer-oracle-allowlist/v1'; entries: AllowEntry[]};

export const EMPTY_ALLOWLIST: Allowlist = {schema: 'explorer-oracle-allowlist/v1', entries: []};

export function loadAllowlist(file: string): Allowlist {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Allowlist;
    if (parsed.schema !== 'explorer-oracle-allowlist/v1' || !Array.isArray(parsed.entries)) {
        throw new Error('Unsupported allowlist file.');
    }
    return parsed;
}

export function compareStrings(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return a < b ? -1 : 1;
}

export function globToRegExp(glob: string): RegExp {
    const source = glob
        .split('**')
        .map((part) =>
            part
                .split('*')
                .map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
                .join('[^/]*'),
        )
        .join('.*');
    return new RegExp(`^${source}$`);
}

function entryMatches(entry: AllowEntry, finding: Omit<Finding, 'count' | 'first_action'>, meta: FindingInput['meta']) {
    if (entry.oracle && entry.oracle !== finding.oracle) {
        return false;
    }
    if (entry.class && entry.class !== finding.class) {
        return false;
    }
    if (entry.path_glob && !globToRegExp(entry.path_glob).test(finding.path.split('?')[0])) {
        return false;
    }
    if (entry.evidence_regex && !new RegExp(entry.evidence_regex).test(finding.evidence)) {
        return false;
    }
    if (entry.method && entry.method !== meta?.method) {
        return false;
    }
    if (entry.statuses && (meta?.status === undefined || !entry.statuses.includes(meta.status))) {
        return false;
    }
    return true;
}

/**
 * The single choke point for findings: scrubs every field, applies the allowlist, de-duplicates on
 * (oracle, class, path, evidence) and serializes in a fixed order, so equal observations give equal bytes.
 */
export class FindingSink {
    readonly scrubber: Scrubber;
    readonly allowlist: Allowlist;
    private readonly byKey = new Map<string, Finding>();
    private readonly suppressedBy = new Map<string, number>();
    private checkpointSeen = new Set<string>();

    constructor(scrubber: Scrubber, allowlist: Allowlist = EMPTY_ALLOWLIST) {
        this.scrubber = scrubber;
        this.allowlist = allowlist;
    }

    startCheckpoint(): void {
        this.checkpointSeen = new Set();
    }

    add(input: FindingInput): void {
        const finding = {
            oracle: input.oracle,
            class: input.class,
            path: this.scrubber.path(input.path),
            evidence: this.scrubber.text(input.evidence),
        };
        const weight = input.weight ?? 1;
        const entryIndex = this.allowlist.entries.findIndex((entry) => entryMatches(entry, finding, input.meta));
        if (entryIndex >= 0) {
            const id = this.allowlist.entries[entryIndex].id ?? `entry-${entryIndex}`;
            this.suppressedBy.set(id, (this.suppressedBy.get(id) ?? 0) + weight);
            return;
        }
        const key = JSON.stringify([finding.oracle, finding.class, finding.path, finding.evidence]);
        if (input.perCheckpoint) {
            if (this.checkpointSeen.has(key)) {
                return;
            }
            this.checkpointSeen.add(key);
        }
        const existing = this.byKey.get(key);
        if (existing) {
            existing.count += weight;
            existing.first_action = Math.min(existing.first_action, input.action);
        } else {
            this.byKey.set(key, {...finding, count: weight, first_action: input.action});
        }
    }

    list(): Finding[] {
        return [...this.byKey.values()].sort(
            (a, b) =>
                compareStrings(a.oracle, b.oracle) ||
                compareStrings(a.class, b.class) ||
                compareStrings(a.path, b.path) ||
                compareStrings(a.evidence, b.evidence),
        );
    }

    suppressed(): Record<string, number> {
        return Object.fromEntries([...this.suppressedBy.entries()].sort(([a], [b]) => compareStrings(a, b)));
    }

    toJsonl(): string {
        const lines = this.list().map((f) =>
            JSON.stringify({
                oracle: f.oracle,
                class: f.class,
                path: f.path,
                evidence: f.evidence,
                count: f.count,
                first_action: f.first_action,
            }),
        );
        return lines.length > 0 ? `${lines.join('\n')}\n` : '';
    }

    write(file: string): void {
        const body = this.toJsonl();
        this.scrubber.assertClean(body);
        fs.writeFileSync(file, body);
    }
}
