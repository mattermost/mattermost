// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';

import {SCENARIOS_PATH} from './paths.ts';
import {compareRoleName} from './snapshot.ts';
import type {RoleName} from './snapshot.ts';

export type Control = RoleName & {
    exact: boolean;
    why?: string;
    name_match?: 'exact' | 'contains';
    name_match_note?: string;
    source_ref?: string;
};

export type Scenario = {
    id: string;
    matrix_ref: string;
    title: string;
    allowed_controls: Control[];
    fixed_inputs: unknown[];
    assertion_locators: Control[];
    reachable_path: string[];
    expected_outcome: Record<string, string[]>;
    dedupe_key: string;
};

export type DeclaredStep =
    | {kind: 'navigate'; path: string}
    | {kind: 'click'; role: string; name: string}
    | {kind: 'checkpoint'; label: string};

export function readScenarios(): Scenario[] {
    const doc = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf-8')) as {scenarios: Scenario[]};
    return [...doc.scenarios].sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function readMatrix(): Array<{id: string; status: string}> {
    return (JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf-8')) as {matrix: Array<{id: string; status: string}>})
        .matrix;
}

export function parseStep(step: string): DeclaredStep {
    const navigate = /^navigate (\/\S+)/.exec(step);
    if (navigate) {
        return {kind: 'navigate', path: navigate[1]};
    }
    const click = /^click (\w+) '(.+)'$/.exec(step);
    if (click) {
        return {kind: 'click', role: click[1], name: click[2]};
    }
    const checkpoint = /^CHECKPOINT (.+)$/.exec(step);
    if (checkpoint) {
        return {kind: 'checkpoint', label: checkpoint[1]};
    }
    throw new Error(`Unrecognised reachable_path step: ${step}`);
}

export function startPath(scenario: Scenario): string {
    const first = parseStep(scenario.reachable_path[0]);
    if (first.kind !== 'navigate') {
        throw new Error(`${scenario.id}: reachable_path must start with a navigate step.`);
    }
    return first.path;
}

/** Union of the scenarios' exact-match allowed controls, deduplicated and sorted. */
export function allowlist(scenarios: Scenario[]): Control[] {
    const seen = new Map<string, Control>();
    for (const s of scenarios) {
        for (const c of s.allowed_controls) {
            if (c.exact !== true) {
                throw new Error(`${s.id}: allowed control ${c.role} "${c.name}" must be exact.`);
            }
            seen.set(JSON.stringify([c.role, c.name]), {role: c.role, name: c.name, exact: true});
        }
    }
    return [...seen.values()].sort(compareRoleName);
}
