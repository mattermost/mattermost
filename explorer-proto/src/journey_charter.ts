// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
        server_preconditions?: {how?: string; expect?: Record<string, Json>};
        team?: {name_template: string; type: string};
        actors?: JourneyActor[];
        channels?: Array<Record<string, Json>>;
        preferences?: Array<Record<string, Json>>;
        viewed_last?: string;
        fixed_strings?: Record<string, string>;
        read_back?: string;
    };
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
    };
    budget: {
        max_actions: number;
        max_depth: number;
        max_states: number;
        max_replays: number;
        wall_clock_seconds: number;
    };
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
    return charter;
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
