// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';
import fs from 'node:fs';

import {charterPath} from './charter.ts';

export const JOURNEY_CHARTER_SCHEMA = 'explorer-journey-charter/v1';

// The charter is JSON with a fixed schema; its predicate/event sub-objects are interpreted
// structurally by the REST/UI evaluators, so they are kept as opaque records here.
export type Json = unknown;

export type JourneyActor = {
    id: string;
    first_name?: string;
    last_name?: string;
    username_template?: string;
    email_template?: string;
    roles?: string;
    team_member?: boolean;
    ui?: boolean;
};

export type JourneyCharter = {
    schema: string;
    journey_id: string;
    feature_id: string[];
    goal: string;
    fixture: Record<string, Json> & {
        slug_rule?: string;
        server_preconditions?: {how?: string; source?: string; expect?: Record<string, Json>};
        team?: {name_template: string; type: string};
        actors?: JourneyActor[];
        channels?: Array<Record<string, Json>>;
        posts?: Array<Record<string, Json> & {key: string; channel: string}>;
        preferences?: Array<Record<string, Json>>;
        viewed_last?: string;
        fixed_strings?: Record<string, string>;
        read_back?: string;
    };
    target_release?: Record<string, Json> & {build_identity_report?: string};
    start: {actor: string; start_path: string};
    action_rules: Record<string, Json>;
    goal_terms: {derive_from: string; stopwords: string[]};
    checkpoints: Array<Record<string, Json> & {id: string; kind: 'rest' | 'ui'}>;
    events: Array<Record<string, Json> & {id: string}>;
    success_criteria: {
        qualifies_when: string;
        ordering?: string;
        path_conditions?: string;
        selection?: string;
        outcomes?: {
            per_state_classification: Record<string, string>;
            run_verdict: Record<string, string>;
            precedence: string[];
        };
    };
    observation_policy?: Record<string, Json>;
    budget: {
        max_actions: number;
        max_depth: number;
        max_states: number;
        max_replays: number;
        wall_clock_seconds: number;
    };
    budget_reserve?: {confirmation_replays_reserved?: number};
};

export function readJourneyCharter(journey: string): JourneyCharter {
    const charter = JSON.parse(fs.readFileSync(charterPath(journey), 'utf-8')) as JourneyCharter;
    if (charter.schema !== JOURNEY_CHARTER_SCHEMA) {
        throw new Error(`Unsupported journey charter schema: ${charter.schema}`);
    }
    if (!/^\/\S+$/.test(charter.start?.start_path ?? '')) {
        throw new Error('journey charter start.start_path must be an absolute path.');
    }
    for (const key of ['max_actions', 'max_depth', 'max_states', 'max_replays', 'wall_clock_seconds'] as const) {
        const v = charter.budget?.[key];
        if (!Number.isInteger(v) || v < 1) {
            throw new Error(`journey charter budget ${key} must be a positive integer.`);
        }
    }
    const reserved = charter.budget_reserve?.confirmation_replays_reserved;
    if (
        reserved !== undefined &&
        (!Number.isInteger(reserved) || reserved < 0 || reserved >= charter.budget.max_replays)
    ) {
        throw new Error(
            'journey charter budget_reserve.confirmation_replays_reserved must be an integer below max_replays.',
        );
    }
    return charter;
}

export function charterFileSha256(journey: string): string {
    return crypto
        .createHash('sha256')
        .update(fs.readFileSync(charterPath(journey)))
        .digest('hex');
}

/**
 * Runtime values discovered while running a replay. Expected literals never come from here; only
 * ids and the fresh fixture's own slug/names are bound, exactly as the charter's {..} templates ask.
 */
export type Bindings = {
    team: {id: string; name: string};
    actor: Record<string, {id: string; username: string; password: string; email: string}>;
    channel: Record<string, {id: string; name: string; display_name: string}>;
    event: Record<string, Record<string, string>>;
    fixture: {fixed_strings: Record<string, string>};
    post?: Record<string, {id: string}>;
};

function lookup(bindings: Bindings, dotted: string): string | undefined {
    let node: unknown = bindings;
    for (const part of dotted.split('.')) {
        if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
            node = (node as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return typeof node === 'string' ? node : undefined;
}

/** Replaces every {dotted.path} in a string with its bound value; throws on an unbound template. */
export function resolveTemplate(text: string, bindings: Bindings): string {
    return text.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, key: string) => {
        const value = lookup(bindings, key);
        if (value === undefined) {
            throw new Error(`Unbound charter template {${key}}`);
        }
        return value;
    });
}

/**
 * Reads a dotted path with optional array indexes (`a.b[0].c`, `a.list.length`). A segment that does not
 * exist yields undefined. Paths without brackets behave exactly like a plain dotted lookup.
 */
export function readPath(obj: unknown, dotted: string): unknown {
    let node: unknown = obj;
    for (const segment of dotted.split('.')) {
        const m = /^([^[\]]*)((?:\[\d+\])+)$/.exec(segment);
        const keys = m ? [...(m[1] ? [m[1]] : []), ...[...m[2].matchAll(/\[(\d+)\]/g)].map((x) => x[1])] : [segment];
        for (const key of keys) {
            if (node && typeof node === 'object' && key in (node as Record<string, unknown>)) {
                node = (node as Record<string, unknown>)[key];
            } else {
                return undefined;
            }
        }
    }
    return node;
}

/** Structural equality for JSON values; key order does not matter, extra keys do. */
export function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const ka = Object.keys(a).sort();
        const kb = Object.keys(b).sort();
        return (
            deepEqual(ka, kb) &&
            ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
        );
    }
    return false;
}

/** resolveTemplate applied to every string inside a JSON value (objects and arrays are copied). */
export function resolveDeep(value: unknown, bindings: Bindings): unknown {
    if (typeof value === 'string') {
        return resolveTemplate(value, bindings);
    }
    if (Array.isArray(value)) {
        return value.map((v) => resolveDeep(v, bindings));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveDeep(v, bindings)]));
    }
    return value;
}

/** True when the string carries no unresolved {template}. */
export function isFullyBound(text: string, bindings: Bindings): boolean {
    try {
        resolveTemplate(text, bindings);
        return true;
    } catch {
        return false;
    }
}

const WORD_RE = /[a-z0-9]+/g;

/** Deterministic, journey-independent stemming: lowercase, then strip one trailing ing/ed/es/s. */
export function stem(token: string): string {
    const lower = token.toLowerCase();
    for (const suffix of ['ing', 'ed', 'es', 's']) {
        if (lower.length > suffix.length + 1 && lower.endsWith(suffix)) {
            return lower.slice(0, -suffix.length);
        }
    }
    return lower;
}

/** Stems of a phrase, minus the charter stopwords. */
export function stems(text: string, stopwords: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const m of text.toLowerCase().matchAll(WORD_RE)) {
        if (!stopwords.has(m[0])) {
            out.add(stem(m[0]));
        }
    }
    return out;
}

/** goal_terms derived only from the goal sentence minus the charter stopwords, deterministically. */
export function goalTerms(charter: JourneyCharter): Set<string> {
    const stopwords = new Set((charter.goal_terms.stopwords ?? []).map((w) => w.toLowerCase()));
    return stems(charter.goal, stopwords);
}
